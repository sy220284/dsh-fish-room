import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createCipheriv, randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('预置与自定义人设保存后进入真实 Agent 接话指令，并兼容旧版', async t => {
  const home = mkdtempSync(join(tmpdir(), 'fish-persona-'))
  t.after(() => rmSync(home, { recursive: true, force: true }))
  process.env.DSH_HOME = home

  const { apply } = await import('../index.js?persona-runtime=' + Date.now())
  const routes = new Map(), prompts = [], streams = [], outgoing = []
  const oldFetch = global.fetch
  global.fetch = async (url, init={}) => {
    if (init.method === 'POST') {
      outgoing.push({ url: String(url), body: init.body })
      return { ok: true, json: async () => ({ id: 'delivered' }) }
    }
    const stream = { pending: null, queue: [], closed: false }
    const reader = {
      read() {
        if (stream.queue.length) return Promise.resolve({ done: false, value: stream.queue.shift() })
        if (stream.closed) return Promise.resolve({ done: true })
        return new Promise(resolve => { stream.pending = resolve })
      },
      cancel() {
        stream.closed = true
        if (stream.pending) stream.pending({ done: true })
        return Promise.resolve()
      },
    }
    stream.feed = data => {
      if (stream.pending) {
        const resolve=stream.pending
        stream.pending=null
        resolve({ done: false, value: data })
      } else stream.queue.push(data)
    }
    streams.push({ address: String(url), stream })
    return { ok: true, body: { getReader: () => reader } }
  }
  t.after(() => { global.fetch = oldFetch })

  const webServer = { register({path,handler}) { routes.set(path,handler) } }
  const handle = {
    sessionId: 'agent-room-角色讨论',
    agent: {
      session: { id: 'agent-room-角色讨论' },
      followup(message) { prompts.push(message.content[0].text) },
      whenIdle() { return Promise.resolve() },
    },
    dispose() {},
  }
  const ctx = {
    tools: { register() { return () => {} } },
    agents: {
      list: async () => [],
      resume: async () => { throw new Error('新建测试会话') },
      create: async () => handle,
    },
    get(name) { if (name === 'sessions') return { get() { return { deriveMessages() { return [{role:'assistant',content:'收到'}] } } } } },
    inject(names,cb) { cb({ webServer, effect(fn) { fn() } }) },
  }
  const dispose = apply(ctx,{
    room:'角色讨论',displayName:'本地 Agent',persona:'旧版自定义：说话慢一点、语气沉稳',
    passphrase:'test-shared-secret',autoReply:true,maxRounds:2,cooldownSec:0,turnTimeoutSec:15,
  })
  t.after(() => dispose?.())
  await new Promise(resolve => setTimeout(resolve, 1330))
  assert.ok(routes.has('/fish-room/settings'), '必须有真实设置接口')
  assert.ok(streams.length >= 1,'必须已连接真实订阅逻辑')

  async function request(path, method='GET', body) {
    const req=Readable.from(body ? [Buffer.from(JSON.stringify(body))] : [])
    req.url=path
    req.method=method
    req.headers={host:'localhost:3001',origin:'http://localhost:3001'}
    const res={
      status:0, data:'',
      writeHead(status) { this.status=status },
      end(data='') { this.data=String(data) },
      write() {},
    }
    await routes.get(path.split('?')[0])(req,res)
    return { status:res.status, json:JSON.parse(res.data) }
  }
  const first = await request('/fish-room/settings')
  assert.equal(first.status,200)
  assert.equal(first.json.rooms[0].personaPreset,'custom','旧版 persona 必须转为自定义模式')
  assert.equal(first.json.rooms[0].persona,'旧版自定义：说话慢一点、语气沉稳')
  const ids=first.json.personas.map(p=>p.id)
  assert.deepEqual(ids,['follow','friendly','caring','analytical','playful','concise','curious',
    'tieba_bro','tieba_hot','tieba_fun',
    'thunder_absurd','thunder_roast','thunder_sarcasm','thunder_rant',
    'thunder_tough','thunder_drama','thunder_riddle','thunder_meme','custom'])
  const groupCounts=Object.fromEntries(['standard','tieba','thunder','custom'].map(group=>[
    group,first.json.personas.filter(p=>p.group===group).length,
  ]))
  assert.deepEqual(groupCounts,{standard:7,tieba:3,thunder:8,custom:1},
    '服务端必须完整返回分类，无重复或遗漏')
  assert.equal(new Set(ids).size,ids.length,'人设 ID 不能重复')
  assert.ok(first.json.personas.every(p=>p.label&&p.description&&p.example&&!('prompt' in p)),
    'UI 只接收人设展示信息，执行指令以服务端为准')

  function encrypted(text, index) {
    const msg={v:2,room:'角色讨论',from:'remote-machine',fromName:'另一位成员',
      text,ts:Date.now()+index*10000,kind:'human',round:0}
    const iv=randomBytes(12)
    const key=createHash('sha256').update('test-shared-secret').digest()
    const cipher=createCipheriv('aes-256-gcm',key,iv)
    const bytes=Buffer.concat([cipher.update(JSON.stringify(msg),'utf8'),cipher.final()])
    const packed=[iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),bytes.toString('base64url')].join('.')
    return Buffer.from('data: '+JSON.stringify({id:'remote-event-'+index,payload:packed})+'\n\n')
  }
  async function receive(text,index) {
    const count=prompts.length
    const publications=outgoing.length
    streams[0].stream.feed(encrypted(text,index))
    const deadline=Date.now()+3000
    while(prompts.length===count&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10))
    assert.equal(prompts.length,count+1,'必须真正调用智能体，且调用一次')
    while(outgoing.length===publications&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10))
    assert.ok(outgoing.length>publications,'智能体接话应该发回中继')
    await new Promise(resolve=>setImmediate(resolve))
    return prompts.at(-1)
  }
  const legacyPrompt=await receive('旧版设置试聊',1)
  assert.match(legacyPrompt,/旧版自定义：说话慢一点、语气沉稳/)

  async function save(patch) {
    const current=(await request('/fish-room/settings')).json.rooms[0]
    return request('/fish-room/settings','POST',{rooms:[{
      ...current,originalName:'角色讨论',passphrase:'******',cooldownSec:0,...patch,
    }]})
  }
  const chosen=await save({personaPreset:'analytical'})
  assert.equal(chosen.status,200,JSON.stringify(chosen.json))
  assert.equal(chosen.json.rooms[0].personaPreset,'analytical')
  assert.equal(chosen.json.rooms[0].personaLabel,'理性清晰')
  const analytical=await receive('切换预置后的试聊',2)
  assert.match(analytical,/【当前聊天人设：理性清晰】/)
  assert.match(analytical,/理性、清醒、思路清晰/)
  assert.doesNotMatch(analytical,/旧版自定义：说话慢一点、语气沉稳/)

  // 六个预置逐一触发真实 Agent，不只校验下拉选项存在。
  const otherStyles=[
    ['friendly','自然随和'],
    ['caring','温柔体贴'],
    ['playful','轻松幽默'],
    ['concise','简洁干练'],
    ['curious','好奇探索'],
    ['tieba_bro','贴吧老哥'],
    ['tieba_hot','贴吧神评'],
    ['tieba_fun','贴吧乐子人'],
    ['thunder_absurd','雷霆抽象'],
    ['thunder_roast','雷霆锐评'],
    ['thunder_sarcasm','雷霆阴阳'],
    ['thunder_rant','雷霆暴躁'],
    ['thunder_tough','雷霆嘴硬'],
    ['thunder_drama','雷霆戏精'],
    ['thunder_riddle','雷霆谜语人'],
    ['thunder_meme','雷霆梗王'],
  ]
  for (let i=0;i<otherStyles.length;i++){
    const [id,label]=otherStyles[i]
    const chosenStyle=await save({personaPreset:id})
    assert.equal(chosenStyle.status,200)
    assert.equal(chosenStyle.json.rooms[0].personaLabel,label)
    const prompt=await receive('逐项验证 '+label,i+3)
    assert.ok(prompt.includes('【当前聊天人设：'+label+'】'),'人设标签必须随选择变化')
    if (id.startsWith('thunder_')) {
      assert.match(prompt,/雷霆系共同语感/,'雷霆各变体应该共享抽象口头禅的基调')
      assert.match(prompt,/吓我一雷霆/)
    } else {
      assert.doesNotMatch(prompt,/雷霆系共同语感/,'贴吧和常用人设不能混入雷霆话风')
    }
    assert.doesNotMatch(prompt,/旧版自定义：说话慢一点、语气沉稳/)
  }

  const customText='你是一个见多识广但不卖弄学识的旅行者，说话简短，喜欢贴近生活的比喻。'
  const custom=await save({personaPreset:'custom',persona:customText})
  assert.equal(custom.status,200,JSON.stringify(custom.json))
  const customPrompt=await receive('切换自定义后的试聊',19)
  assert.match(customPrompt,/【当前聊天人设：自定义人设】/)
  assert.ok(customPrompt.includes(customText))
  assert.doesNotMatch(customPrompt,/理性、清醒、思路清晰/)

  const follow=await save({personaPreset:'follow'})
  assert.equal(follow.status,200)
  const defaultPrompt=await receive('跟随智能体的试聊',20)
  assert.doesNotMatch(defaultPrompt,/【当前聊天人设：/)
  assert.doesNotMatch(defaultPrompt,/见多识广但不卖弄学识/)
  assert.match(defaultPrompt,/群房间「角色讨论」/)

  const invalid=await save({personaPreset:'invalid-id'})
  assert.equal(invalid.status,400)
  const empty=await save({personaPreset:'custom',persona:'  '})
  assert.equal(empty.status,400)
  const tooLong=await save({personaPreset:'custom',persona:'字'.repeat(2001)})
  assert.equal(tooLong.status,400)
  assert.equal((await request('/fish-room/settings')).json.rooms[0].personaPreset,'follow',
    '非法编辑不应覆盖已生效的人设')
  const disk=JSON.parse(readFileSync(join(home,'plugins-data','fishroom','room.json'),'utf8'))
  assert.equal(disk.rooms[0].personaPreset,'follow')
  assert.equal(disk.rooms[0].persona,customText,'切换回预置后应保留自定义草稿')
  assert.ok(outgoing.length>=20,'每次自动接话都应通过消息中继发布')
})
