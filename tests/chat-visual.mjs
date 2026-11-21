import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { chromium } from 'playwright-core'

const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
function readConst(name) {
  const match = source.match(new RegExp('^const ' + name + ' = (".*")$', 'm'))
  assert.ok(match, name + ' 应存在')
  return JSON.parse(match[1])
}
const pageHtml=readConst('PAGE'), css=readConst('CHAT_CSS')
const messages=[
  {id:'1',from:'other',fromName:'小青鱼',kind:'agent',ts:1763721000000,text:'房间连接成功。我们可以在这里同步讨论想法。'},
  {id:'2',from:'self',fromName:'我',kind:'human',ts:1763721060000,text:'先检查一下聊天页面的阅读体验，看看长消息、成员状态和输入区域是否清楚。'},
  {id:'3',from:'other',fromName:'白鲸助手',kind:'agent',ts:1763721120000,text:'收到。长内容应该保持自然换行，聊天区独立滚动，输入框始终可用。\n\n搜索历史、房间切换和导出记录放在需要的时候调用。这样长时间聊天也不会被复杂工具打断。'},
  {id:'4',from:'other',fromName:'海岸观察员',kind:'guest',ts:1763721180000,text:'这是一条用来检查中文排版和极长无空格文本是否会冲出边界的消息：'+('A1B2C3D4'.repeat(22))},
]
const rooms=[{name:'海湾讨论',connected:true},{name:'协作试验',connected:true},{name:'归档回看',connected:false}]
const members=[{name:'小青鱼',online:true},{name:'白鲸助手',online:true},{name:'海岸观察员',online:false}]
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost')
  res.setHeader('Cache-Control','no-store')
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
} finally {
  await browser.close()
  server.close()
}
