import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Script, createContext } from 'node:vm'

const serverSource = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
const clientSource = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function extract(name) {
  const match = serverSource.match(new RegExp('^const ' + name + ' = (".*")$', 'm'))
  assert.ok(match, name + ' 必须在 index.js 中定义')
  return JSON.parse(match[1])
}
const page = extract('PAGE')
const css = extract('CHAT_CSS')
const script = page.match(/<script>([\s\S]*?)<\/script>/)?.[1]

test('页面脚本与内嵌 React 模块通过语法校验', () => {
  assert.ok(script)
  new Script(script, { filename: 'fish-room-page.js' })
  new Script(clientSource, { filename: 'client.js' })
})

test('独立页、内嵌页具备共同结构与移动断点', () => {
  for (const name of ['rooms', 'members', 'list', 'search', 'query', 'input', 'file', 'send', 'error', 'typing']) {
    assert.match(page, new RegExp('id="' + name + '"'))
  }
  for (const name of ['fr-root', 'fr-sidebar', 'fr-conversation', 'fr-message', 'fr-composer', 'fr-search']) {
    assert.ok(page.includes(name) && css.includes(name) && clientSource.includes(name), name)
  }
  assert.ok(css.includes('@media(max-width:800px)'), '移动端应重排为单列')
  assert.ok(css.includes('.fr-root [hidden]{display:none!important}'), '隐藏状态不得被类样式覆盖')
  assert.ok(serverSource.includes("reg('/fish-room/ui.css'"), '共用样式必须通过接口提供')
  assert.equal(page.includes('bottom-nav'), false, '不使用底部导航')
  assert.equal(page.includes('innerHTML'), false, '消息使用安全 DOM 节点渲染')
})

test('夜潮工作区视觉基线及无障碍基础不应退化', () => {
  assert.ok(css.includes('鱼房间 · 夜潮工作区'), '应保留统一的产品设计体系')
  assert.match(css, /--fr-bg:#0d191f/, '背景应使用带蓝调的深色中性层')
  assert.match(css, /--fr-accent:#8cdec8/, '操作重点色保持一致')
  assert.ok(css.includes('@media(max-width:800px)'), '必须保持手机单列布局')
  assert.ok(css.includes('prefers-reduced-motion:reduce'), '减少动态效果的系统偏好必须生效')
  assert.ok(css.includes('.fr-root button:focus-visible'), '键盘焦点必须清晰可见')
  assert.ok(clientSource.includes("function UiGlyph(props)"), '操作按钮必须使用统一矢量图标')
  assert.ok(clientSource.includes("className: 'fr-brand-mark'"), '鱼形品牌标记需要保留')
  assert.ok(clientSource.includes("className: 'fr-persona-choices'"), '人设选择器必须保留')
  assert.ok(clientSource.includes("className: 'fr-settings-savebar'"), '设置保存操作不能丢失')
})

test('聊天室接口版本和视图契约应统一', () => {
  assert.ok(clientSource.includes('schemaVersion !== 2'), '客户端对响应版本进行校验')
  assert.ok(clientSource.includes('function chatView(response)'), '聊天视图具有统一的转换检查')
  assert.ok(clientSource.includes('function settingsView(response)'), '设置响应具有统一的转换检查')
  assert.ok(clientSource.includes('className: \'fr-settings-jump\''), '设置章节快捷导航存在')
  assert.ok(clientSource.includes('className: \'fr-persona-preview\''), '选择预置时必须展示语气预览')
  assert.ok(css.includes('.fr-settings-jump'), '导航有明确视觉样式')
  assert.ok(css.includes('.fr-persona-preview'), '人设预览使用独立层级')
})

function harness() {
  const elements = new Map()
  class Element {
    constructor(tag='div') {
      this.tagName = tag
      this.children = []
      this.textContent = ''
      this.value = ''
      this.scrollTop = 0
      this.scrollHeight = 1200
      this.clientHeight = 300
      this.hidden = false
      this.files = []
      this.listeners = {}
      this.attributes = {}
      this.className = ''
      this.classes = new Set()
      this.classList = {
        add: (...keys) => { for (const k of keys) this.classes.add(k) },
        remove: (...keys) => { for (const k of keys) this.classes.delete(k) },
        toggle: (key, force) => {
          const next = force === undefined ? !this.classes.has(key) : !!force
          if (next) this.classes.add(key)
          else this.classes.delete(key)
          return next
        },
        contains: key => this.classes.has(key),
      }
    }
    addEventListener(key, fn) { this.listeners[key] = fn }
    setAttribute(key, value) { this.attributes[key] = value }
    appendChild(child) { this.children.push(child); return child }
    append(...children) { for (const item of children) this.appendChild(item) }
    replaceChildren(...children) { this.children = [...children] }
    focus() { this.focused = true }
    click() { return this.listeners.click?.({ currentTarget: this }) }
    fire(kind, event={}) { return this.listeners[kind]?.({ preventDefault() {}, currentTarget: this, ...event }) }
  }
  const required = ['sidebar','room-count','rooms','members-toggle','members','online-count','presence',
    'connection-text','room-title','subtitle','status','typing','typing-text','list','search-count',
    'new-messages','send','input','file','attachment','file-name','remove-file','attach',
    'error','error-text','clear-error','search','query','search-toggle','close-search','refresh','export']
  for (const id of required) elements.set(id,new Element(id))
  elements.get('search').hidden = true
  elements.get('typing').hidden = true
  elements.get('attachment').hidden = true
  elements.get('error').hidden = true

  const messages = [
    { id:'m1', from:'remote', fromName:'对方', kind:'agent', text:'普通消息', ts:1722000000000 },
    { id:'m2', from:'remote', fromName:'对方', kind:'agent', text:'重要关键词', ts:1722000010000 },
  ]
  const calls = []
  let failSend = false
  const configs = [
    {name:'fish-lake',connected:true,typing:false},
    {name:'second',connected:false,typing:false},
  ]
  const fetch = async (path,options={}) => {
    calls.push({path,options})
    const json = async () => {
      if(path.startsWith('/fish-room/state')) {
        const current = new URL('http://test'+path).searchParams.get('room') || 'fish-lake'
        return {ok:true,schemaVersion:2,room:current,
          rooms:configs.map(r=>({name:r.name,connected:r.connected})),me:{id:'self',name:'我'},
          members:[{name:'对方',online:true}],messages:[...messages],
          config:{connected:current==='fish-lake',typing:false,draft:'',personaLabel:'跟随智能体'},
          ui:{connection:{state:current==='fish-lake'?'online':'offline',
              label:current==='fish-lake'?'已连接':'连接中断',detail:'房间通讯正常'},
            presence:{online:1,total:1},persona:{id:'follow',label:'跟随智能体'}}}
      }
      if(path.startsWith('/fish-room/history')) return {ok:true,total:1,messages:[messages[1]]}
      if(path==='/fish-room/media') return {ok:true,media:{type:'text/plain',name:'hello.txt',url:'https://example.test/hello.txt'}}
      if(path==='/fish-room/send') {
        if (failSend) return {ok:false,error:'模拟发送失败'}
        messages.push({id:'m'+messages.length,from:'self',fromName:'我',kind:'human',text:JSON.parse(options.body).text,ts:1722000030000})
        return {ok:true}
      }
      return {ok:false,error:'unknown path'}
    }
    return {ok:true,json}
  }
  class Reader {
    readAsDataURL() { this.result='data:text/plain;base64,SGVsbG8='; queueMicrotask(()=>this.onload()) }
  }
  class EventSource {
    constructor(path) { this.path=path }
    close() { this.closed=true }
  }
  const doc = {
    hidden:false,
    getElementById:id=>elements.get(id),
    createElement:tag=>new Element(tag),
    addEventListener() {},
  }
  const win = {addEventListener() {},open() {}}
  const context = createContext({document:doc,window:win,EventSource,FileReader:Reader,URL,
    Notification:{permission:'default'},fetch,console,setInterval:()=>1,clearInterval(){},
    Date,Set,Promise,queueMicrotask})
  new Script(script).runInContext(context)
  const tick = async () => { await new Promise(resolve=>setImmediate(resolve)) }
  return {elements,calls,messages,tick,fail:()=>{failSend=true}}
}

test('搜索结果在状态刷新后仍保持筛选', async () => {
  const app=harness()
  await app.tick()
  const get=id=>app.elements.get(id)
  get('search-toggle').click()
  assert.equal(get('search').hidden,false)
  get('query').value='重要'
  await get('search').fire('submit')
  assert.match(get('search-count').textContent,/找到 1 条/)
  assert.equal(get('list').children.filter(x=>x.tagName==='article').length,1)
  get('refresh').click()
  await app.tick()
  assert.equal(get('list').children.filter(x=>x.tagName==='article').length,1)
  get('close-search').click()
  assert.equal(get('search').hidden,true)
  assert.equal(get('list').children.filter(x=>x.tagName==='article').length,2)
})

test('发送失败保留输入、展示错误，成功后清空', async () => {
  const app=harness()
  await app.tick()
  const get=id=>app.elements.get(id)
  get('input').value='这是待发送内容'
  get('input').fire('input')
  assert.equal(get('send').disabled,false)
  app.fail()
  await get('send').click()
  assert.equal(get('input').value,'这是待发送内容')
  assert.equal(get('error').hidden,false)
  assert.match(get('error-text').textContent,/模拟发送失败/)
})

test('仅附件发送与房间切换保持真实接口参数', async () => {
  const app=harness()
  await app.tick()
  const get=id=>app.elements.get(id)
  get('file').files=[{name:'hello.txt',type:'text/plain'}]
  get('file').fire('change')
  assert.equal(get('attachment').hidden,false)
  await get('send').click()
  const sent=app.calls.find(c=>c.path==='/fish-room/send')
  assert.ok(sent,'实际请求发送接口')
  const body=JSON.parse(sent.options.body)
  assert.equal(body.room,'fish-lake')
  assert.equal(body.text,'')
  assert.equal(body.media[0].name,'hello.txt')
  assert.equal(get('input').value,'')
  const other=get('rooms').children.find(x=>x.children[1]?.textContent==='second')
  other.click()
  await app.tick()
  assert.equal(get('room-title').textContent,'second')
})
