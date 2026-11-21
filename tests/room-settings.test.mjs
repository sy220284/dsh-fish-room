import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('DSH 插件设置保存后立即更新房间、Agent 身份、中继连接和成员配置', async t => {
  const home=mkdtempSync(join(tmpdir(),'fishroom-test-'))
  t.after(()=>rmSync(home,{recursive:true,force:true}))
  process.env.DSH_HOME=home
  const {apply}=await import('../index.js?live-settings-test='+Date.now())
  const routes=new Map(),subscriptions=[],publishes=[]
  const oldFetch=global.fetch
  global.fetch=async (url,options={})=>{
    const address=String(url)
    if(options.method==='POST'){
      publishes.push({address,body:options.body})
      return {ok:true,json:async()=>({id:'sent'})}
    }
    subscriptions.push(address)
    let release
    const reader={
      read(){return new Promise(resolve=>{release=resolve})},
      cancel(){ if(release)release({done:true});return Promise.resolve() }
    }
    return {ok:true,body:{getReader:()=>reader}}
  }
  t.after(()=>{global.fetch=oldFetch})
  const webServer={register({path,handler}){routes.set(path,handler);return ()=>routes.delete(path)}}
  const host={webServer,effect(fn){return fn()}}
  const ctx={
    tools:{register(){return ()=>{}}},
    agents:{},
    inject(names,cb){cb(host)},
  }
  const dispose=apply(ctx,{room:'原始鱼塘',displayName:'本机小鱼',passphrase:'shared-secret',server:'https://ntfy.sh',autoReply:false})
  t.after(()=>dispose?.())
  await new Promise(resolve=>setTimeout(resolve,1350))
  assert.ok(routes.has('/fish-room/settings'),'插件应注册设置接口')
  assert.ok(routes.has('/fish-room/state'),'插件应注册聊天接口')

  async function request(path,method='GET',body){
    const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[])
    req.method=method
    req.url=path
    req.headers={host:'127.0.0.1:3080',origin:'http://127.0.0.1:3080'}
    const output={status:0,body:'',headers:{},
      writeHead(status,headers={}){this.status=status;this.headers=headers},
      end(value=''){this.body=String(value)},write(){}}
    await routes.get(path.split('?')[0])(req,output)
    const json=JSON.parse(output.body)
    return {status:output.status,json}
  }
  const initial=await request('/fish-room/state')
  assert.equal(initial.status,200)
  assert.equal(initial.json.room,'原始鱼塘')
  assert.equal(initial.json.rooms.length,1)
  assert.equal(initial.json.me.name,'本机小鱼')

  const first={
    name:'原始鱼塘',originalName:'原始鱼塘',displayName:'新显示名字',
    server:'https://example.test',transport:'ntfy',topic:'fish-new-topic',
    autoReply:false,passphrase:'******',maxRounds:2,cooldownSec:15,
    turnTimeoutSec:180,allow:['白鲸助手'],deny:[],owner:'',
    provider:'',model:'',persona:'有条理',personaPreset:'analytical',cwd:'',
  }
  const second={
    name:'第二间房',originalName:'',displayName:'协作 Agent',
    server:'https://example.test',transport:'ntfy',topic:'',
    autoReply:false,passphrase:'fresh-secret',maxRounds:2,cooldownSec:15,
    turnTimeoutSec:180,allow:[],deny:[],owner:'',
    provider:'',model:'',persona:'你是一个开朗的旅行者。',personaPreset:'custom',cwd:'',
  }
  const updated=await request('/fish-room/settings','POST',{rooms:[first,second]})
  assert.equal(updated.status,200,JSON.stringify(updated.json))
  assert.equal(updated.json.rooms.length,2)
  assert.equal(updated.json.rooms[0].displayName,'新显示名字')
  assert.equal(updated.json.rooms[0].hasPassphrase,true)
  assert.ok(!JSON.stringify(updated.json).includes('shared-secret'),'接口不能泄露口令')
  const newState=await request('/fish-room/state?room=%E5%8E%9F%E5%A7%8B%E9%B1%BC%E5%A1%98')
  assert.equal(newState.json.me.name,'新显示名字')
  assert.equal(newState.json.config.topic,'fish-new-topic')
  assert.equal(newState.json.config.personaPreset,'analytical')
  assert.equal(newState.json.config.personaLabel,'理性清晰')
  const secondState=await request('/fish-room/state?room='+encodeURIComponent('第二间房'))
  assert.equal(secondState.json.config.personaPreset,'custom')
  assert.equal(secondState.json.config.persona,'你是一个开朗的旅行者。')
  assert.deepEqual(newState.json.config.allow,['白鲸助手'])
  assert.ok(subscriptions.some(url=>url.includes('example.test/fish-new-topic/')),'应重新订阅新的中继主题')
  assert.ok(subscriptions.some(url=>url.includes('example.test/dsh-room-')&&url.includes('/sse')),'新增房间必须立即开始订阅')

  const send=await request('/fish-room/send','POST',{room:'原始鱼塘',text:'保存后验证'})
  assert.equal(send.status,200,JSON.stringify(send.json))
  const sentState=await request('/fish-room/state?room=%E5%8E%9F%E5%A7%8B%E9%B1%BC%E5%A1%98')
  assert.equal(sentState.json.messages.at(-1).fromName,'新显示名字')

  const duplicate=await request('/fish-room/settings','POST',{rooms:[first,{...second,name:'原始鱼塘'}]})
  assert.equal(duplicate.status,400)
  assert.equal((await request('/fish-room/settings')).json.rooms.length,2,'验证失败不得影响现有配置')

  const removed=await request('/fish-room/settings','POST',{rooms:[{...second,originalName:'第二间房',passphrase:'******'}]})
  assert.equal(removed.status,200)
  assert.equal((await request('/fish-room/settings')).json.rooms[0].name,'第二间房')
  assert.equal((await request('/fish-room/state')).json.room,'第二间房')
  const cfgFile=join(home,'plugins-data','fishroom','room.json')
  const disk=JSON.parse(readFileSync(cfgFile,'utf8'))
  assert.equal(disk.rooms.length,1)
  assert.equal(disk.rooms[0].name,'第二间房')
  assert.equal(disk.rooms[0].passphrase,'fresh-secret')
  assert.equal(disk.rooms[0].personaPreset,'custom')
  assert.equal(disk.rooms[0].persona,'你是一个开朗的旅行者。')
  if(process.platform!=='win32')assert.equal(statSync(cfgFile).mode&0o777,0o600)
})
