import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { chromium } from 'playwright-core'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
const require=createRequire(import.meta.url)

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
function readConst(name) {
  const match = source.match(new RegExp('^const ' + name + ' = (".*")$', 'm'))
  assert.ok(match, name + ' 应存在')
  return JSON.parse(match[1])
}
const pageHtml=readConst('PAGE'), css=readConst('CHAT_CSS')
const clientJs=readFileSync(new URL('../client.js',import.meta.url),'utf8')
const reactUmd=join(dirname(require.resolve('react/package.json')),'umd','react.development.js')
const reactDomUmd=join(dirname(require.resolve('react-dom/package.json')),'umd','react-dom.development.js')
const messages=[
  {id:'1',from:'other',fromName:'小青鱼',kind:'agent',ts:1763721000000,text:'房间连接成功。我们可以在这里同步讨论想法。'},
  {id:'2',from:'self',fromName:'我',kind:'human',ts:1763721060000,text:'先检查一下聊天页面的阅读体验，看看长消息、成员状态和输入区域是否清楚。'},
  {id:'3',from:'other',fromName:'白鲸助手',kind:'agent',ts:1763721120000,text:'收到。长内容应该保持自然换行，聊天区独立滚动，输入框始终可用。\n\n搜索历史、房间切换和导出记录放在需要的时候调用。这样长时间聊天也不会被复杂工具打断。'},
  {id:'4',from:'other',fromName:'海岸观察员',kind:'guest',ts:1763721180000,text:'这是一条用来检查中文排版和极长无空格文本是否会冲出边界的消息：'+('A1B2C3D4'.repeat(22))},
]
const rooms=[{name:'海湾讨论',connected:true},{name:'协作试验',connected:true},{name:'归档回看',connected:false}]
const members=[{name:'小青鱼',online:true},{name:'白鲸助手',online:true},{name:'海岸观察员',online:false}]
const personaChoices=[
  ['follow','跟随智能体','standard'],
  ['friendly','自然随和','standard'],['caring','温柔体贴','standard'],
  ['analytical','理性清晰','standard'],['playful','轻松幽默','standard'],
  ['concise','简洁干练','standard'],['curious','好奇探索','standard'],
  ['tieba_bro','贴吧老哥','tieba'],['tieba_hot','贴吧神评','tieba'],
  ['tieba_fun','贴吧乐子人','tieba'],
  ['thunder_absurd','雷霆抽象','thunder'],['thunder_roast','雷霆锐评','thunder'],
  ['thunder_sarcasm','雷霆阴阳','thunder'],['thunder_rant','雷霆暴躁','thunder'],
  ['thunder_tough','雷霆嘴硬','thunder'],['thunder_drama','雷霆戏精','thunder'],
  ['thunder_riddle','雷霆谜语人','thunder'],['thunder_meme','雷霆梗王','thunder'],
  ['custom','自定义人设','custom'],
].map(([id,label,group])=>({id,label,group,
  description:group==='thunder'?'充满戏剧反差的雷霆系对话':group==='tieba'?'贴吧社区特色聊天':'跟随或自选的表达方式',
  example:'一句贴合角色特点的聊天回复'}))
let lastSettingsPayload=null
let settingsRooms=rooms.map(r=>({...r,displayName:'本机小鱼',server:'https://ntfy.sh',transport:'ntfy',topic:'dsh-room-'+r.name,personaPreset:'follow',persona:'',
  hasPassphrase:true,persona:'聊天简短清楚',autoReply:true,maxRounds:2,cooldownSec:15,turnTimeoutSec:180,
  allow:[],deny:[],owner:'',provider:'',model:'',cwd:''}))

const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost')
  res.setHeader('Cache-Control','no-store')
  if(url.pathname==='/host'){
    res.setHeader('Content-Type','text/html; charset=utf-8')
    res.end('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link href="/fish-room/ui.css" rel="stylesheet"></head><body style="margin:0;background:#111a1c;color:#edf4f0"><main id="dsh-host"></main></body></html>');return
  }
  if(url.pathname==='/fish-room/settings'){
    res.setHeader('Content-Type','application/json; charset=utf-8')
    if(req.method==='POST'){
      const chunks=[];for await(const chunk of req)chunks.push(chunk)
      lastSettingsPayload=JSON.parse(Buffer.concat(chunks).toString('utf8'))
      settingsRooms=lastSettingsPayload.rooms.map(r=>({...r,hasPassphrase:!!r.passphrase,connected:true}))
    }
    res.end(JSON.stringify({ok:true,rooms:settingsRooms,personas:personaChoices}));return
  }
  if(url.pathname==='/fish-room'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(pageHtml);return}
  if(url.pathname==='/fish-room/ui.css'){res.setHeader('Content-Type','text/css; charset=utf-8');res.end(css);return}
  if(url.pathname==='/fish-room/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.write(': alive\n\n');req.on('close',()=>res.end());return}
  if(url.pathname==='/fish-room/state'){
    res.setHeader('Content-Type','application/json')
    res.end(JSON.stringify({ok:true,room:url.searchParams.get('room')||rooms[0].name,rooms,me:{id:'self',name:'我'},
      messages,members,config:{connected:true,typing:false}}));return
  }
  if(url.pathname==='/fish-room/history'){
    const q=url.searchParams.get('q')||''
    const found=messages.filter(m=>m.text.includes(q)||m.fromName.includes(q))
    res.setHeader('Content-Type','application/json')
    res.end(JSON.stringify({ok:true,messages:found,total:found.length}));return
  }
  if(url.pathname==='/fish-room/send'){
    const chunks=[]
    for await(const chunk of req)chunks.push(chunk)
    const data=JSON.parse(Buffer.concat(chunks).toString('utf8'))
    messages.push({id:String(messages.length+1),from:'self',fromName:'我',kind:'human',ts:Date.now(),text:data.text})
    res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return
  }
  res.writeHead(404);res.end('not found')
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const base='http://127.0.0.1:'+server.address().port
const executablePath=process.env.CHROME_BIN||'/usr/bin/google-chrome'
const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-dev-shm-usage']})
mkdirSync('screenshots',{recursive:true})
try {
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['small',320,700]]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto(base+'/fish-room',{waitUntil:'domcontentloaded'})
    await page.locator('.fr-message').first().waitFor()
    await page.locator('#send').waitFor({state:'visible'})
    await page.screenshot({path:'screenshots/chat-'+name+'.png',fullPage:true})
    const layout=await page.evaluate(()=>{
      const list=document.querySelector('#list'),composer=document.querySelector('.fr-composer'),
        root=document.querySelector('.fr-root'),sidebar=document.querySelector('.fr-sidebar')
      return {documentWidth:document.documentElement.scrollWidth,viewportWidth:window.innerWidth,
        rootWidth:root.getBoundingClientRect().width,composerWidth:composer.getBoundingClientRect().width,
        sideHeight:sidebar.getBoundingClientRect().height,logHeight:list.getBoundingClientRect().height,
        sendVisible:document.querySelector('#send').getBoundingClientRect().height>0,
        searchHidden:getComputedStyle(document.querySelector('#search')).display==='none',
        fileHidden:getComputedStyle(document.querySelector('#attachment')).display==='none'}
    })
    assert.ok(layout.documentWidth<=layout.viewportWidth+1,name+' 出现水平溢出 '+JSON.stringify(layout))
    assert.ok(layout.logHeight>100,name+' 消息阅读区域过小')
    assert.ok(layout.sendVisible,name+' 发送按钮不可见')
    assert.ok(layout.searchHidden&&layout.fileHidden,name+' 辅助层默认遮挡主页面')
    assert.deepEqual(errors,[],name+' 页面报错')
    if(name==='mobile'){
      await page.locator('#members-toggle').click()
      await page.locator('#members').waitFor({state:'visible'})
      await page.locator('#members-toggle').click()
      await page.locator('#search-toggle').click()
      await page.locator('#query').fill('长内容')
      await page.locator('.fr-search-submit').click()
      await page.waitForFunction(()=>document.querySelector('#search-count').textContent.includes('1 条'))
      assert.equal(await page.locator('.fr-message').count(),1,'搜索必须只显示匹配消息')
      await page.locator('#close-search').click()
      assert.equal(await page.locator('.fr-message').count(),4,'退出搜索应恢复消息')
      await page.locator('#input').fill('浏览器测试消息')
      await page.locator('#send').click()
      await page.waitForFunction(()=>document.querySelectorAll('.fr-message').length===5)
      assert.equal(await page.locator('#input').inputValue(),'','成功发送后清空')
    }
    console.log(name,JSON.stringify(layout))
    await page.close()
  }
  // 验证 DSH 宿主内的真实 React 插件入口：聊天面板、聊天内设置、设置分区
  async function mountDsh(page, component) {
    await page.goto(base+'/host',{waitUntil:'domcontentloaded'})
    await page.evaluate(()=>{window.__ModuleLoader__={load(entry){this.entry=entry}}})
    await page.addScriptTag({path:reactUmd})
    await page.addScriptTag({path:reactDomUmd})
    await page.addScriptTag({content:clientJs})
    await page.evaluate(which=>{
      const plugin=window.__ModuleLoader__.entry.factory(name=> {
        if(name==='react')return window.React
        throw Error('未知依赖 '+name)
      })
      const slots={
        inject(name,callback){callback();return ()=>{}},
        register(info,Component) {
          if(info.name===which) {
            window.ReactDOM.createRoot(document.getElementById('dsh-host')).render(window.React.createElement(Component))
          }
          return ()=>{}
        },
      }
      plugin.apply({slots})
    },component)
  }
  for(const [name,width,height] of [['embedded-desktop',1440,900],['embedded-mobile',390,844],['embedded-small',320,700]]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1})
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await mountDsh(page,'main')
    await page.locator('.fr-chat-heading').waitFor()
    await page.locator('.fr-message').first().waitFor()
    await page.screenshot({path:'screenshots/'+name+'-chat.png',fullPage:true})
    const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,
      mainHeight:document.querySelector('.fr-message-area').getBoundingClientRect().height,
      sendVisible:document.querySelector('.fr-send').getBoundingClientRect().height>0}))
    assert.ok(metrics.width<=metrics.viewport+1,name+' 宿主页不应出现水平溢出 '+JSON.stringify(metrics))
    assert.ok(metrics.mainHeight>100&&metrics.sendVisible,name+' 消息区和发送控件必须可用')
    await page.getByRole('button',{name:'房间设置'}).click()
    await page.locator('.fr-settings-overlay .fr-settings').waitFor()
    await page.screenshot({path:'screenshots/'+name+'-settings.png',fullPage:true})
    const settingsLayout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,
      saveVisible:document.querySelector('.fr-settings-savebar').getBoundingClientRect().height>0}))
    assert.ok(settingsLayout.width<=settingsLayout.viewport+1,name+' 设置不应产生水平溢出')
    assert.equal(settingsLayout.saveVisible,true,'保存操作应可用')
    await page.getByRole('tab',{name:/雷霆/}).click()
    assert.equal(await page.locator('.fr-persona-choice').count(),8,name+' 应完整展示雷霆分类')
    await page.screenshot({path:'screenshots/'+name+'-personas-thunder.png',fullPage:true})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),
      name+' 雷霆人设卡片不应产生水平溢出')
    if(name==='embedded-mobile'){
      await page.locator('#fish-setting-0-displayName').fill('新显示名称')
      assert.equal(await page.locator('.fr-persona-category').count(),4,'四类人设切换入口要齐全')
      assert.equal(await page.locator('.fr-persona-choice').count(),7,'常用人设应有 7 款')
      await page.locator('input[type="radio"][value="analytical"]').check()
      assert.match(await page.locator('.fr-persona-current').textContent(),/理性清晰/)
      await page.getByRole('tab',{name:/贴吧/}).click()
      assert.equal(await page.locator('.fr-persona-choice').count(),3,'贴吧类应有 3 款')
      await page.locator('input[type="radio"][value="tieba_bro"]').check()
      assert.match(await page.locator('.fr-persona-current').textContent(),/贴吧老哥/)
      await page.screenshot({path:'screenshots/embedded-mobile-persona-tieba.png',fullPage:true})
      await page.getByRole('tab',{name:/雷霆/}).click()
      assert.equal(await page.locator('.fr-persona-choice').count(),8,'雷霆类应有 8 款')
      await page.locator('input[type="radio"][value="thunder_rant"]').check()
      assert.match(await page.locator('.fr-persona-current').textContent(),/雷霆暴躁/)
      await page.screenshot({path:'screenshots/embedded-mobile-persona-thunder.png',fullPage:true})
      await page.getByRole('tab',{name:/自定义/}).click()
      await page.locator('input[type="radio"][value="custom"]').check()
      await page.locator('#fish-setting-0-persona').fill('你是善于发现故事的旅行者，说话干脆，偶尔幽默。')
      await page.screenshot({path:'screenshots/embedded-mobile-persona-custom.png',fullPage:true})
      await page.getByRole('tab',{name:/常用/}).click()
      await page.locator('input[type="radio"][value="friendly"]').check()
      assert.equal(await page.locator('#fish-setting-0-persona').count(),0,'非自定义模式不应占用输入区')
      await page.getByRole('tab',{name:/自定义/}).click()
      await page.locator('input[type="radio"][value="custom"]').check()
      assert.equal(await page.locator('#fish-setting-0-persona').inputValue(),'你是善于发现故事的旅行者，说话干脆，偶尔幽默。','切换预置不能丢失自定义内容')
      await page.locator('.fr-settings-submit').click()
      await page.getByText('配置已保存并应用，连接状态会在页面中更新').waitFor()
      assert.equal(lastSettingsPayload.rooms[0].displayName,'新显示名称')
      assert.equal(lastSettingsPayload.rooms[0].personaPreset,'custom')
      assert.equal(lastSettingsPayload.rooms[0].persona,'你是善于发现故事的旅行者，说话干脆，偶尔幽默。')
      assert.equal(lastSettingsPayload.rooms[0].originalName,'海湾讨论')
      await page.locator('.fr-settings-close').click()
      await page.locator('.fr-chat-heading').waitFor()
      await page.locator('.fr-message').first().waitFor()
    }
    assert.deepEqual(errors,[],name+' 的 React 组件运行报错')
    await page.close()
  }
  const settingsPage=await browser.newPage({viewport:{width:390,height:844}})
  await mountDsh(settingsPage,'settings.section')
  await settingsPage.getByRole('heading',{name:'鱼房间设置'}).waitFor()
  assert.equal(await settingsPage.locator('.fr-settings-card').count(),5,'DSH 原设置分区应展示完整的设置结构')
  assert.equal(await settingsPage.locator('.fr-persona-choice').count(),7,'DSH 设置分区常用人设应有 7 款')
  await settingsPage.getByRole('tab',{name:/贴吧/}).click()
  assert.equal(await settingsPage.locator('.fr-persona-choice').count(),3,'DSH 设置分区应包含贴吧风格')
  await settingsPage.getByRole('tab',{name:/雷霆/}).click()
  assert.equal(await settingsPage.locator('.fr-persona-choice').count(),8,'DSH 设置分区应包含全部雷霆风格')
  await settingsPage.screenshot({path:'screenshots/dsh-settings-section-thunder.png',fullPage:true})
  await settingsPage.screenshot({path:'screenshots/dsh-settings-section.png',fullPage:true})
  await settingsPage.close()
} finally {
  await browser.close()
  server.close()
}
