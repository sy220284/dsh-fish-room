/* dsh-fish-room —— 浏览器半边（手写 __ModuleLoader__ bundle，无构建步骤）。
 *
 * 在 DSH Web 里占三个位置：
 *   1. 左侧栏「鱼房间」入口（sidebar.panellist）
 *   2. 主面板：聊天界面（main keyed slot）
 *   3. 设置页「鱼房间」分区（settings.section）
 *
 * 数据全部走插件自己的同源路由：/fish-room/state | /fish-room/send |
 * /fish-room/settings | /fish-room/events(SSE)。
 * 全程 try/catch：客户端半边任何一处抛异常都会让整个 Web UI 拒绝渲染。
 */
window.__ModuleLoader__.load({
  id: 'dsh-fish-room',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef

    var PANEL_ID = 'fish-room'

    // ── 主题色（跟随 DSW 变量，没有就兜底）────────────────────
    var C = {
      bg: 'var(--dsw-alias-bg-primary, #1b1d22)',
      card: 'var(--dsw-alias-bg-secondary, #23262c)',
      line: 'var(--dsw-alias-border-l2, rgba(128,128,128,0.28))',
      fg: 'var(--dsw-alias-text-primary, #e9e9ec)',
      sub: 'var(--dsw-alias-text-secondary, #9a9aa2)',
      accent: 'var(--dsw-alias-accent, #4a7dff)',
      mine: 'var(--dsw-alias-accent-soft, #2b3550)',
      agent: 'var(--dsw-alias-accent-softer, #2a2440)',
    }

    var s = {
      card: {
        maxWidth: 820,
        margin: '0 auto',
        padding: '18px 20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontSize: 13.5,
        lineHeight: 1.65,
        color: C.fg,
      },
      head: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      title: { fontSize: 17, fontWeight: 650, letterSpacing: 0.2 },
      chip: {
        fontSize: 11.5,
        color: C.sub,
        background: C.card,
        border: '1px solid ' + C.line,
        borderRadius: 999,
        padding: '2px 9px',
      },
      dot: { width: 8, height: 8, borderRadius: 999, background: '#666' },
      dotOn: { width: 8, height: 8, borderRadius: 999, background: '#3ddc84' },
      list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        minHeight: 220,
        maxHeight: '52vh',
        overflowY: 'auto',
        padding: '4px 2px',
      },
      msg: {
        maxWidth: '76%',
        borderRadius: 14,
        padding: '9px 12px',
        background: C.card,
        border: '1px solid ' + C.line,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      },
      msgMine: { maxWidth: '76%', borderRadius: 14, padding: '9px 12px', background: C.mine, border: '1px solid ' + C.line, whiteSpace: 'pre-wrap', wordBreak: 'break-word', alignSelf: 'flex-end' },
      msgAgent: { borderColor: 'rgba(122,92,255,0.55)' },
      who: { fontSize: 11, color: C.sub, marginBottom: 3, display: 'flex', gap: 6, alignItems: 'center' },
      time: { fontSize: 10.5, color: C.sub, marginTop: 4, textAlign: 'right' },
      input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 150,
        resize: 'none',
        padding: '11px 12px',
        borderRadius: 12,
        border: '1px solid ' + C.line,
        background: C.card,
        color: C.fg,
        font: 'inherit',
        lineHeight: 1.5,
      },
      btn: {
        padding: '10px 18px',
        borderRadius: 12,
        border: '1px solid ' + C.accent,
        background: C.accent,
        color: '#fff',
        fontSize: 13.5,
        cursor: 'pointer',
      },
      ghost: {
        padding: '6px 12px',
        borderRadius: 9,
        border: '1px solid ' + C.line,
        background: 'transparent',
        color: C.sub,
        fontSize: 12,
        cursor: 'pointer',
      },
      quick: { display: 'flex', gap: 6, flexWrap: 'wrap' },
      field: {
        width: '100%',
        padding: '9px 11px',
        borderRadius: 10,
        border: '1px solid ' + C.line,
        background: C.card,
        color: C.fg,
        font: 'inherit',
      },
      label: { fontSize: 12, color: C.sub, margin: '12px 0 5px' },
      hint: { fontSize: 11.5, color: C.sub, opacity: 0.85 },
      err: { fontSize: 12, color: '#e55' },
      ok: { fontSize: 12, color: '#4ad07a' },
    }

    function fmtTime(ts) {
      var d = new Date(ts || Date.now())
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    }

    function api(path, opts) {
      return fetch(path, opts).then(function (r) {
        return r.json().catch(function () { return {} })
      })
    }

    // ── 聊天主面板 ───────────────────────────────────────────
    function ChatPanel() {
      var st = useState({ ok: false, messages: [], members: [], me: { id: '' } })
      var data = st[0]
      var setData = st[1]
      var st2 = useState('')
      var draft = st2[0]
      var setDraft = st2[1]
      var st3 = useState(false)
      var sending = st3[0]
      var setSending = st3[1]
      var boxRef = useRef(null)
      var seenIds = useRef({})

      var reload = React.useCallback(function () {
        return api('/fish-room/state', { cache: 'no-store' }).then(function (j) {
          if (j && j.ok) setData(j)
          return j
        }).catch(function () { return null })
      }, [])

      useEffect(function () {
        reload()
        var timer = setInterval(reload, 15000)
        var es = null
        try {
          es = new EventSource('/fish-room/events')
          es.onmessage = function (e) {
            try {
              var p = JSON.parse(e.data)
              if (p && p.type === 'message') {
                if (p.message && p.message.id) seenIds.current[p.message.id] = 1
                reload()
              } else if (p && p.type === 'status') {
                reload()
              }
            } catch (err) { /* 忽略坏包 */ }
          }
        } catch (err) { /* SSE 不可用就靠轮询 */ }
        return function () {
          clearInterval(timer)
          try { if (es) es.close() } catch (err) { /* ignore */ }
        }
      }, [])

      useEffect(function () {
        try {
          var el = boxRef.current
          if (el) el.scrollTop = el.scrollHeight
        } catch (err) { /* ignore */ }
      }, [data.messages && data.messages.length])

      var send = function () {
        var text = draft.trim()
        if (!text || sending) return
        setSending(true)
        api('/fish-room/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text }),
        }).then(function (j) {
          if (!j || !j.ok) window.alert((j && j.error) || '发送失败')
          setDraft('')
          return reload()
        }).catch(function () { /* ignore */ }).then(function () { setSending(false) })
      }

      var msgs = (data.messages || []).filter(function (m) { return m && m.id })
      var members = data.members || []

      return h('div', { style: s.card },
        h('div', { style: s.head },
          h('span', { style: data.connected ? s.dotOn : s.dot }),
          h('div', { style: s.title }, data.room || '鱼房间'),
          h('span', { style: s.chip }, (members.length || 0) + ' 人在房间里'),
          h('span', { style: s.chip }, '我是 ' + ((data.me && data.me.name) || 'agent')),
          h('span', { style: { flex: 1 } }),
          h('button', { style: s.ghost, onClick: function () { reload() } }, '刷新')
        ),

        h('div', { ref: boxRef, style: s.list },
          msgs.length === 0
            ? h('div', { style: { color: C.sub, textAlign: 'center', padding: '46px 0' } },
                '房间里还没有人说话。', h('br'), '发一句，或者等对面的鱼先开口。')
            : msgs.map(function (m) {
                var mine = data.me && m.from === data.me.id
                var isAgent = m.kind === 'agent'
                var style = mine ? s.msgMine : s.msg
                if (!mine && isAgent) style = Object.assign({}, style, s.msgAgent)
                return h('div', { key: m.id, style: Object.assign({}, style, { alignSelf: mine ? 'flex-end' : 'flex-start' }) },
                    !mine && h('div', { style: s.who },
                        h('span', null, m.fromName || '?'),
                        isAgent ? h('span', { style: { color: '#a58cff' } }, '· agent') : null),
                    h('div', null, m.text),
                    h('div', { style: s.time }, fmtTime(m.ts))
                )
              })
        ),

        h('div', { style: s.quick },
          h('button', { style: s.ghost, onClick: function () { setDraft('在吗？'); } }, '在吗？'),
          h('button', { style: s.ghost, onClick: function () { setDraft('你是谁呀？'); } }, '你是谁呀？'),
          h('button', { style: s.ghost, onClick: function () { setDraft('说说你自己'); } }, '说说你自己'),
          h('button', { style: s.ghost, onClick: function () { setDraft('来聊聊最近的事'); } }, '来聊聊最近的事')
        ),

        h('div', { style: { display: 'flex', gap: 8, alignItems: 'flex-end' } },
          h('textarea', {
            style: s.input,
            value: draft,
            placeholder: '在房间里说点什么…（Enter 发送，Shift+Enter 换行）',
            onChange: function (e) { setDraft(e.target.value) },
            onKeyDown: function (e) {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            },
          }),
          h('button', { style: s.btn, disabled: sending, onClick: send }, sending ? '发送中…' : '发送')
        ),
        h('div', { style: s.hint }, '房间里的对话是 agent 之间在聊；你在这里发的消息会进房间，对面的鱼会回应。')
      )
    }

    // ── 设置分区 ─────────────────────────────────────────────
    function SettingsPanel() {
      var st = useState(null)
      var cfg = st[0]
      var setCfg = st[1]
      var st2 = useState('')
      var msg = st2[0]
      var setMsg = st2[1]
      var st3 = useState('')
      var pass = st3[0]
      var setPass = st3[1]

      useEffect(function () {
        api('/fish-room/settings').then(function (j) {
          if (j && j.ok) setCfg(j.config || {})
        }).catch(function () { /* ignore */ })
      }, [])

      if (!cfg) return h('div', { style: { padding: 20, color: C.sub } }, '正在读取房间配置…')

      var set = function (k, v) {
        setCfg(function (prev) {
          var next = Object.assign({}, prev)
          next[k] = v
          return next
        })
      }

      var save = function () {
        var patch = {
          room: cfg.room,
          displayName: cfg.displayName,
          persona: cfg.persona,
          server: cfg.server,
          autoReply: !!cfg.autoReply,
          maxRounds: Number(cfg.maxRounds || 2),
          cooldownSec: Number(cfg.cooldownSec || 15),
        }
        if (pass) patch.passphrase = pass
        api('/fish-room/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        }).then(function (j) {
          setMsg(j && j.ok ? '保存好了' : '保存失败：' + ((j && j.error) || '未知错误'))
          if (j && j.ok) setPass('')
        }).catch(function (e) { setMsg('保存失败：' + String(e)) })
      }

      return h('div', { style: { maxWidth: 640, color: C.fg, fontSize: 13.5, lineHeight: 1.6 } },
        h('div', { style: { fontSize: 16, fontWeight: 600, marginBottom: 4 } }, '鱼房间'),
        h('div', { style: s.hint }, '两台 DSH 填一样的「房间名」和「口令」就能进同一个屋檐。口令同时是消息的加密密钥，改完立刻生效，不用重启。'),

        h('div', { style: { display: 'flex', gap: 12 } },
          h('div', { style: { flex: 1 } },
            h('div', { style: s.label }, '房间名（两边一致）'),
            h('input', { className: 'x', style: s.field, value: cfg.room || '', onChange: function (e) { set('room', e.target.value) } })),
          h('div', { style: { flex: 1 } },
            h('div', { style: s.label }, '我的名字'),
            h('input', { className: 'x', style: s.field, value: cfg.displayName || '', onChange: function (e) { set('displayName', e.target.value) } }))
        ),

        h('div', { style: s.label }, '口令（两边一致；用于加密，留空则用房间名当密钥）'),
        h('input', {
          className: 'x',
          style: s.field,
          type: 'password',
          value: pass,
          placeholder: cfg.hasPassphrase ? '（已保存，留空则不改）' : '（未设置）',
          onChange: function (e) { setPass(e.target.value) },
        }),

        h('div', { style: s.label }, '房间人格（每条消息前都会带上）'),
        h('textarea', {
          className: 'x',
          style: Object.assign({}, s.field, { minHeight: 76, resize: 'vertical' }),
          value: cfg.persona || '',
          onChange: function (e) { set('persona', e.target.value) },
        }),

        h('div', { style: s.label }, '中继地址（公共 ntfy / 自建都行）'),
        h('input', { className: 'x', style: s.field, value: cfg.server || '', onChange: function (e) { set('server', e.target.value) } }),

        h('div', { style: { display: 'flex', gap: 16, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' } },
          h('label', { style: { display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' } },
            h('input', { type: 'checkbox', checked: !!cfg.autoReply, onChange: function (e) { set('autoReply', e.target.checked) } }),
            h('span', null, '自动接话')),
          h('div', { style: { width: 120 } },
            h('div', { style: { fontSize: 11.5, color: C.sub, marginBottom: 3 } }, '最多来回轮次'),
            h('input', { className: 'x', type: 'number', min: 0, max: 6, style: s.field, value: cfg.maxRounds ?? 2, onChange: function (e) { set('maxRounds', e.target.value) } })),
          h('div', { style: { width: 140 } },
            h('div', { style: { fontSize: 11.5, color: C.sub, marginBottom: 3 } }, '接话冷却（秒）'),
            h('input', { className: 'x', type: 'number', min: 0, max: 300, style: s.field, value: cfg.cooldownSec ?? 15, onChange: function (e) { set('cooldownSec', e.target.value) } }))
        ),

        h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 } },
          h('button', { style: s.btn, onClick: save }, '保存'),
          msg ? h('span', { style: msg.indexOf('失败') >= 0 ? s.err : s.ok }, msg) : null),
        h('div', { style: { marginTop: 14, fontSize: 11.5, color: C.sub, opacity: 0.85 } },
          '聊天界面在左侧栏「鱼房间」里；也可以直接开 ', h('code', null, '/fish-room'), '。')
      )
    }

    // ── 侧边栏图标 ───────────────────────────────────────────
    function FishIcon() {
      return h('svg', {
        width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('path', { d: 'M3 12c3.5-3.4 7.4-5 12-5 1.6 0 3 .3 4.3.9-1 3.6-3.6 6.2-6.6 7.2-2.6.9-5.4.6-7.5-.8-1-.7-1.8-1.5-2.2-2.3z' }),
        h('circle', { cx: 16.4, cy: 10.6, r: 0.8, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M9 15.4c-1.2 1.4-2.6 2.2-4 2.4M13.5 15.9c.6 1.7 1.8 3 3.4 3.6' })
      )
    }

    function apply(ctx) {
      var slots = ctx && ctx.slots
      if (!slots) return
      var stopSidebar = null
      var stopMain = null
      var stopSettings = null
      try {
        stopSidebar = slots.inject('sidebar.panellist', function () {
          return slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 12,
            label: '鱼房间',
          }, FishIcon)
        })
      } catch (e) { console.warn('[fish-room] 侧边栏入口注册失败', e) }
      try {
        stopMain = slots.inject('main', function () {
          return slots.register({ name: 'main', key: PANEL_ID }, ChatPanel)
        })
      } catch (e) { console.warn('[fish-room] 主面板注册失败', e) }
      try {
        stopSettings = slots.inject('settings.section', function () {
          return slots.register({
            name: 'settings.section',
            id: 'fish-room',
            order: 32,
            label: '鱼房间',
          }, SettingsPanel)
        })
      } catch (e) { console.warn('[fish-room] 设置分区注册失败', e) }
      return function () {
        try { stopSidebar && stopSidebar() } catch (e) { /* ignore */ }
        try { stopMain && stopMain() } catch (e) { /* ignore */ }
        try { stopSettings && stopSettings() } catch (e) { /* ignore */ }
      }
    }

    exports.apply = apply
    // 浏览器侧等的是「服务名」（短名），不是包名；写错会一直 pending，web boot 直接判致命。
    exports.inject = ['slots']
    exports.name = 'fish-room-client'
    return module.exports
  },
})
