/* dsh-fishroom —— 浏览器半边（手写 __ModuleLoader__ bundle，无构建步骤）。
 *
 * 左侧栏「鱼房间」入口 + 主面板聊天界面 + 设置页「鱼房间」分区。
 * 多房间 / 媒体 / 在线状态 / 未读与通知 / 搜索导出 / 权限分级，全在这里。
 * 全程 try/catch：客户端半边任何一处抛异常都会让整个 Web UI 拒绝渲染。
 */
window.__ModuleLoader__.load({
  id: 'dsh-fishroom',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef
    var useCallback = React.useCallback

    var PANEL_ID = 'fish-room'

    var C = {
      card: 'var(--dsw-alias-bg-primary, #1b1d22)',
      card2: 'var(--dsw-alias-bg-secondary, #23262c)',
      line: 'var(--dsw-alias-border-l2, rgba(128,128,128,0.28))',
      fg: 'var(--dsw-alias-text-primary, #e9e9ec)',
      sub: 'var(--dsw-alias-text-secondary, #9a9aa2)',
      accent: 'var(--dsw-alias-accent, #4a7dff)',
      mine: 'var(--dsw-alias-accent-soft, #2b3550)',
      agent: 'var(--dsw-alias-accent-softer, #2a2440)',
    }

    var s = {
      card: {
        maxWidth: 860, margin: '0 auto', padding: '18px 20px 22px', display: 'flex',
        flexDirection: 'column', gap: 12, fontSize: 13.5, lineHeight: 1.65, color: C.fg,
      },
      head: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' },
      title: { fontSize: 17, fontWeight: 650 },
      chip: {
        fontSize: 11.5, color: C.sub, background: C.card2, border: '1px solid ' + C.line,
        borderRadius: 999, padding: '2px 9px',
      },
      dot: { width: 8, height: 8, borderRadius: 999, background: '#666' },
      dotOn: { width: 8, height: 8, borderRadius: 999, background: '#3ddc84' },
      tab: {
        whiteSpace: 'nowrap', border: '1px solid ' + C.line, background: C.card2, color: C.sub,
        borderRadius: 999, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
      },
      tabOn: { borderColor: C.accent, color: C.fg },
      list: {
        display: 'flex', flexDirection: 'column', gap: 9, minHeight: 200, maxHeight: '50vh',
        overflowY: 'auto', padding: '4px 2px',
      },
      msg: {
        maxWidth: '78%', borderRadius: 13, padding: '8px 12px', background: C.card2,
        border: '1px solid ' + C.line, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      },
      msgMine: {
        maxWidth: '78%', borderRadius: 13, padding: '8px 12px', background: C.mine,
        border: '1px solid ' + C.line, whiteSpace: 'pre-wrap', wordBreak: 'break-word', alignSelf: 'flex-end',
      },
      msgAgent: { borderColor: 'rgba(122,92,255,0.55)' },
      msgGuest: { borderStyle: 'dashed' },
      who: { fontSize: 11, color: C.sub, marginBottom: 3 },
      time: { fontSize: 10.5, color: C.sub, marginTop: 4, textAlign: 'right' },
      input: {
        flex: 1, minHeight: 44, maxHeight: 150, resize: 'none', padding: '11px 12px', borderRadius: 12,
        border: '1px solid ' + C.line, background: C.card2, color: C.fg, font: 'inherit', lineHeight: 1.5,
      },
      btn: {
        padding: '10px 18px', borderRadius: 12, border: '1px solid ' + C.accent,
        background: C.accent, color: '#fff', fontSize: 13.5, cursor: 'pointer',
      },
      ghost: {
        padding: '6px 12px', borderRadius: 9, border: '1px solid ' + C.line,
        background: 'transparent', color: C.sub, fontSize: 12, cursor: 'pointer',
      },
      field: {
        width: '100%', padding: '9px 11px', borderRadius: 10, border: '1px solid ' + C.line,
        background: C.card2, color: C.fg, font: 'inherit',
      },
      label: { fontSize: 12, color: C.sub, margin: '11px 0 5px' },
      hint: { fontSize: 11.5, color: C.sub, opacity: 0.85 },
      err: { fontSize: 12, color: '#e55' },
      ok: { fontSize: 12, color: '#4ad07a' },
      media: { marginTop: 6, fontSize: 12 },
      img: { maxWidth: 220, borderRadius: 8, display: 'block', marginTop: 6 },
    }

    function fmtTime(ts) {
      var d = new Date(ts || Date.now())
      return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
    }

    function api(path, opts) {
      return fetch(path, opts).then(function (r) { return r.json().catch(function () { return {} }) })
    }

    function mediaNodes(m) {
      var list = m.media || []
      return list.map(function (x, i) {
        var src = x.local || x.url
        if ((x.type || '').indexOf('image/') === 0) {
          return h('img', { key: i, src: src, style: s.img, alt: x.name || 'image' })
        }
        if ((x.type || '').indexOf('audio/') === 0) {
          return h('div', { key: i, style: s.media },
            h('audio', { controls: true, src: src }),
            h('a', { href: src, target: '_blank', style: { marginLeft: 8, color: C.accent } }, x.name || '语音'))
        }
        return h('div', { key: i, style: s.media },
          h('a', { href: src, target: '_blank', style: { color: C.accent } }, '📎 ' + (x.name || '文件')))
      })
    }

    // ── 聊天主面板 ───────────────────────────────────────────
    function ChatPanel() {
      var st = useState({ ok: false, rooms: [], room: '', messages: [], members: [], me: { id: '' } })
      var data = st[0]
      var setData = st[1]
      var st2 = useState('')
      var room = st2[0]
      var setRoom = st2[1]
      var st3 = useState('')
      var draft = st3[0]
      var setDraft = st3[1]
      var st4 = useState(false)
      var busy = st4[0]
      var setBusy = st4[1]
      var st5 = useState(0)
      var unread = st5[0]
      var setUnread = st5[1]
      var st6 = useState('')
      var query = st6[0]
      var setQuery = st6[1]
      var st7 = useState(false)
      var searching = st7[0]
      var setSearching = st7[1]
      var fileRef = useRef(null)
      var esRef = useRef(null)
      var seenRef = useRef({})

      var reload = useCallback(function () {
        return api('/fish-room/state?room=' + encodeURIComponent(room), { cache: 'no-store' })
          .then(function (j) { if (j && j.ok) setData(j); return j })
          .catch(function () { return null })
      }, [room])

      // 切换房间
      useEffect(function () {
        if (!room && data.rooms && data.rooms.length) setRoom(data.rooms[0].name)
      }, [data.rooms, room])

      useEffect(function () {
        reload()
        var timer = setInterval(reload, 15000)
        return function () { clearInterval(timer) }
      }, [reload])

      // SSE：消息 / 思考 / 流式草稿
      useEffect(function () {
        if (!room) return
        try { if (esRef.current) esRef.current.close() } catch (e) { /* ignore */ }
        var es = null
        try {
          es = new EventSource('/fish-room/events?room=' + encodeURIComponent(room))
          esRef.current = es
          es.onmessage = function (e) {
            try {
              var p = JSON.parse(e.data)
              if (p && p.type === 'message') {
                if (p.message && p.message.from !== data.me.id) {
                  seenRef.current[p.message.id] = 1
                  if (document.hidden) {
                    setUnread(function (n) { return n + 1 })
                    try {
                      if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('鱼房间', { body: (p.message.fromName || '') + '：' + String(p.message.text || '').slice(0, 60) })
                      }
                    } catch (err) { /* ignore */ }
                  }
                }
                reload()
              } else if (p && p.type === 'status') {
                reload()
              }
            } catch (err) { /* ignore */ }
          }
        } catch (e) { /* SSE 不可用就靠轮询 */ }
        return function () { try { if (es) es.close() } catch (err) { /* ignore */ } }
      }, [room])

      var send = function () {
        var text = draft.trim()
        var file = fileRef.current && fileRef.current.files && fileRef.current.files[0]
        if (!text && !file) return
        setBusy(true)
        var done = function () { setDraft(''); setBusy(false); return reload() }
        if (!file) {
          api('/fish-room/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: room, text: text }),
          }).then(function (j) { if (!j || !j.ok) window.alert((j && j.error) || '发送失败'); return done() })
            .catch(function () { setBusy(false) })
          return
        }
        var reader = new FileReader()
        reader.onload = function () {
          var base64 = String(reader.result || '').split(',')[1] || ''
          api('/fish-room/media', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: room, name: file.name, type: file.type, data: base64 }),
          }).then(function (up) {
            if (!up || !up.ok) throw new Error((up && up.error) || '上传失败')
            return api('/fish-room/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room: room, text: text, media: [up.media] }),
            })
          }).then(function (j) { if (!j || !j.ok) window.alert((j && j.error) || '发送失败'); return done() })
            .catch(function (e) { window.alert(String(e && e.message ? e.message : e)); setBusy(false) })
        }
        reader.onerror = function () { setBusy(false) }
        reader.readAsDataURL(file)
      }

      var doSearch = function () {
        setSearching(true)
        api('/fish-room/history?room=' + encodeURIComponent(room) + '&limit=200&q=' + encodeURIComponent(query))
          .then(function (j) {
            if (j && j.ok) setData(function (prev) {
              var next = Object.assign({}, prev)
              next.messages = j.messages
              next.searchTotal = j.total
              return next
            })
          }).catch(function () { /* ignore */ }).then(function () { setSearching(false) })
      }

      var msgs = data.messages || []
      var members = data.members || []
      var cfg = data.config || {}
      var online = members.filter(function (m) { return m.online })

      return h('div', { style: s.card },
        h('div', { style: s.head },
          h('span', { style: cfg.connected ? s.dotOn : s.dot }),
          h('div', { style: s.title }, '鱼房间'),
          h('span', { style: s.chip },
            members.length ? members.slice(0, 4).map(function (m) { return m.name + (m.online ? '🟢' : '⚪') }).join('、') : '还没人说话'),
          h('span', { style: s.chip }, '在线 ' + online.length),
          h('span', { style: { flex: 1 } }),
          h('button', { style: s.ghost, onClick: function () { reload() } }, '刷新'),
          h('button', {
            style: s.ghost,
            onClick: function () {
              try {
                if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
                else window.alert('浏览器通知：' + (typeof Notification === 'undefined' ? '不支持' : Notification.permission))
              } catch (e) { /* ignore */ }
            },
          }, '通知')
        ),

        // 房间切换
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          (data.rooms || []).map(function (r) {
            return h('button', {
              key: r.name,
              style: Object.assign({}, s.tab, r.name === room ? s.tabOn : {}),
              onClick: function () { setRoom(r.name); setUnread(0); setQuery('') },
            }, r.name + (r.connected ? ' ●' : ''))
          })
        ),

        // 搜索
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('input', {
            className: 'x', style: Object.assign({}, s.field, { flex: 1 }),
            value: query, placeholder: '搜房间里的历史（人名、关键词）',
            onChange: function (e) { setQuery(e.target.value) },
            onKeyDown: function (e) { if (e.key === 'Enter') doSearch() },
          }),
          h('button', { style: s.ghost, onClick: doSearch }, searching ? '搜着…' : '搜索'),
          h('button', {
            style: s.ghost,
            onClick: function () { window.open('/fish-room/export?room=' + encodeURIComponent(room) + '&fmt=md', '_blank') },
          }, '导出'),
          data.searchTotal ? h('span', { style: s.hint }, data.searchTotal + ' 条命中') : null
        ),

        // 消息
        h('div', { style: s.list },
          msgs.length === 0
            ? h('div', { style: { color: C.sub, textAlign: 'center', padding: '40px 0' } }, '房间里还没有人说话。发一句，或者等对面的鱼先开口。')
            : msgs.map(function (m) {
                var mine = data.me && m.from === data.me.id
                var style = mine ? s.msgMine : s.msg
                if (!mine && m.kind === 'agent') style = Object.assign({}, style, s.msgAgent)
                if (!mine && m.kind === 'guest') style = Object.assign({}, style, s.msgGuest)
                return h('div', { key: m.id, style: Object.assign({}, style, { alignSelf: mine ? 'flex-end' : 'flex-start' }) },
                    !mine && h('div', { style: s.who },
                        h('span', null, m.fromName || '?'),
                        m.kind === 'agent' ? h('span', { style: { color: '#a58cff' } }, '· agent') : null,
                        m.kind === 'guest' ? h('span', { style: { color: '#d9a441' } }, '· 访客') : null),
                    h('div', null, m.text),
                    mediaNodes(m),
                    h('div', { style: s.time }, fmtTime(m.ts)))
              })
        ),

        cfg.typing ? h('div', { style: { color: C.sub, fontSize: 12 } }, '…对方正在想…') : null,

        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          h('button', { style: s.ghost, onClick: function () { setDraft('在吗？') } }, '在吗？'),
          h('button', { style: s.ghost, onClick: function () { setDraft('你是谁呀？') } }, '你是谁呀？'),
          h('button', { style: s.ghost, onClick: function () { setDraft('说说你自己') } }, '说说你自己'),
          h('button', { style: s.ghost, onClick: function () { setDraft('来聊聊最近的事') } }, '来聊聊最近的事')
        ),

        h('div', { style: { display: 'flex', gap: 8, alignItems: 'flex-end' } },
          h('textarea', {
            style: s.input, value: draft, ref: fileRef,
            placeholder: '在房间里说点什么…（Enter 发送，Shift+Enter 换行；📎 可发图/文件）',
            onChange: function (e) { setDraft(e.target.value) },
            onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } },
          }),
          h('button', {
            style: s.ghost,
            onClick: function () {
              var inp = document.getElementById('fishroom-file')
              if (inp) inp.click()
            },
          }, '📎'),
          h('input', {
            id: 'fishroom-file', type: 'file', style: { display: 'none' },
            ref: function (el) { fileRef.current = el },
          }),
          h('button', { style: s.btn, disabled: busy, onClick: send }, busy ? '发送中…' : '发送')
        ),
        unread > 0 ? h('div', { style: s.hint }, '有 ' + unread + ' 条新消息') : null
      )
    }

    // ── 设置分区：多房间 ───────────────────────────────────
    function SettingsPanel() {
      var st = useState(null)
      var rooms = st[0]
      var setRooms = st[1]
      var st2 = useState('')
      var msg = st2[0]
      var setMsg = st2[1]
      var st3 = useState('')
      var pass = st3[0]
      var setPass = st3[1]

      useEffect(function () {
        api('/fish-room/settings').then(function (j) {
          if (j && j.ok) setRooms((j.rooms || []).map(function (r) { return Object.assign({}, r) }))
        }).catch(function () { /* ignore */ })
      }, [])

      if (!rooms) return h('div', { style: { padding: 20, color: C.sub } }, '正在读取房间配置…')

      var setRoom = function (i, k, v) {
        setRooms(function (prev) {
          var next = prev.map(function (r, idx) { return idx === i ? Object.assign({}, r, (function () { var o = {}; o[k] = v; return o })()) : r })
          return next
        })
      }

      var save = function () {
        // 口令留空/掩码时，服务端会保留原来的
        var payload = rooms.map(function (r, i) {
          var o = Object.assign({}, r)
          if (i === 0 && pass) o.passphrase = pass
          else if (r.hasPassphrase && !r.passphrase) o.passphrase = '******'
          return o
        })
        api('/fish-room/settings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rooms: payload }),
        }).then(function (j) {
          if (j && j.ok) { setMsg('保存好了'); setPass('') }
          else setMsg('保存失败：' + ((j && j.error) || '未知错误'))
        }).catch(function (e) { setMsg('保存失败：' + String(e)) })
      }

      return h('div', { style: { maxWidth: 700, color: C.fg, fontSize: 13.5, lineHeight: 1.6 } },
        h('div', { style: { fontSize: 16, fontWeight: 600, marginBottom: 4 } }, '鱼房间'),
        h('div', { style: s.hint },
          '每个房间对应一组「房间名 + 口令」。两边填一样的就能进同一个屋檐；口令同时是消息的加密密钥，改完立刻生效，不用重启。'),

        rooms.map(function (r, i) {
          return h('div', {
            key: r.name + i,
            style: { border: '1px solid ' + C.line, borderRadius: 12, padding: '12px 14px', marginTop: 14, background: C.card2 },
          },
            h('div', { style: { display: 'flex', gap: 10 } },
              h('div', { style: { flex: 1 } },
                h('div', { style: s.label }, '房间名（两边一致）'),
                h('input', { className: 'x', style: s.field, value: r.name || '', onChange: function (e) { setRoom(i, 'name', e.target.value) } })),
              h('div', { style: { flex: 1 } },
                h('div', { style: s.label }, '我的名字'),
                h('input', { className: 'x', style: s.field, value: r.displayName || '', onChange: function (e) { setRoom(i, 'displayName', e.target.value) } }))
            ),
            h('div', { style: s.label }, '口令（两边一致；留空则用房间名当密钥）'),
            h('input', {
              className: 'x', style: s.field, type: 'password', value: i === 0 ? pass : '',
              placeholder: r.hasPassphrase ? '（已保存，留空则不改）' : '（未设置）',
              onChange: function (e) { if (i === 0) setPass(e.target.value); else setRoom(i, 'passphrase', e.target.value) },
            }),
            h('div', { style: s.label }, '房间人格（每条消息前都会带上）'),
            h('textarea', {
              className: 'x', style: Object.assign({}, s.field, { minHeight: 66, resize: 'vertical' }),
              value: r.persona || '', onChange: function (e) { setRoom(i, 'persona', e.target.value) },
            }),
            h('div', { style: { display: 'flex', gap: 10 } },
              h('div', { style: { flex: 1 } },
                h('div', { style: s.label }, '白名单（留空=不限；一行一个名字）'),
                h('textarea', {
                  className: 'x', style: Object.assign({}, s.field, { minHeight: 48, resize: 'vertical' }),
                  value: (r.allow || []).join('\n'),
                  onChange: function (e) { setRoom(i, 'allow', e.target.value.split('\n').map(function (x) { return x.trim() }).filter(Boolean)) },
                })),
              h('div', { style: { flex: 1 } },
                h('div', { style: s.label }, '黑名单（一行一个名字）'),
                h('textarea', {
                  className: 'x', style: Object.assign({}, s.field, { minHeight: 48, resize: 'vertical' }),
                  value: (r.deny || []).join('\n'),
                  onChange: function (e) { setRoom(i, 'deny', e.target.value.split('\n').map(function (x) { return x.trim() }).filter(Boolean)) },
                }))
            ),
            h('div', { style: { display: 'flex', gap: 10 } },
              h('div', { style: { flex: 1 } },
                h('div', { style: s.label }, 'Provider（留空=跟宿主默认）'),
                h('input', { className: 'x', style: s.field, value: r.provider || '', placeholder: 'minimax-cn', onChange: function (e) { setRoom(i, 'provider', e.target.value) } })),
              h('div', { style: { flex: 1 } },
                h('div', { style: s.label }, 'Model（留空=跟宿主默认）'),
                h('input', { className: 'x', style: s.field, value: r.model || '', placeholder: 'MiniMax-M3.1-Flash', onChange: function (e) { setRoom(i, 'model', e.target.value) } }))
            ),
            h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' } },
              h('label', { style: { display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' } },
                h('input', { type: 'checkbox', checked: !!r.autoReply, onChange: function (e) { setRoom(i, 'autoReply', e.target.checked) } }),
                h('span', null, '自动接话')),
              h('div', { style: { width: 110 } },
                h('div', { style: { fontSize: 11.5, color: C.sub, marginBottom: 3 } }, '最多来回轮次'),
                h('input', { className: 'x', type: 'number', min: 0, max: 6, style: s.field, value: r.maxRounds ?? 2, onChange: function (e) { setRoom(i, 'maxRounds', Number(e.target.value)) } })),
              h('div', { style: { width: 130 } },
                h('div', { style: { fontSize: 11.5, color: C.sub, marginBottom: 3 } }, '接话冷却（秒）'),
                h('input', { className: 'x', type: 'number', min: 0, max: 300, style: s.field, value: r.cooldownSec ?? 15, onChange: function (e) { setRoom(i, 'cooldownSec', Number(e.target.value)) } })),
              h('div', { style: { width: 150 } },
                h('div', { style: { fontSize: 11.5, color: C.sub, marginBottom: 3 } }, '工作目录（默认读 AGENTS.md）'),
                h('input', { className: 'x', style: s.field, value: r.cwd || '', placeholder: '留空=DSH_HOME', onChange: function (e) { setRoom(i, 'cwd', e.target.value) } }))
            ),
            h('button', {
              style: Object.assign({}, s.ghost, { marginTop: 10 }),
              onClick: function () { setRooms(function (prev) { return prev.filter(function (_, idx) { return idx !== i }) }) },
            }, '删掉这个房间')
          )
        }),

        h('button', {
          style: Object.assign({}, s.ghost, { marginTop: 14 }),
          onClick: function () {
            setRooms(function (prev) {
              return prev.concat([{
                name: 'room-' + (prev.length + 1), displayName: '', persona: '', server: 'https://ntfy.sh',
                autoReply: true, maxRounds: 2, cooldownSec: 15, allow: [], deny: [],
              }])
            })
          },
        }, '+ 加一个房间'),

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
          return slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 12, label: '鱼房间' }, FishIcon)
        })
      } catch (e) { console.warn('[fishroom] 侧边栏入口注册失败', e) }
      try {
        stopMain = slots.inject('main', function () {
          return slots.register({ name: 'main', key: PANEL_ID }, ChatPanel)
        })
      } catch (e) { console.warn('[fishroom] 主面板注册失败', e) }
      try {
        stopSettings = slots.inject('settings.section', function () {
          return slots.register({ name: 'settings.section', id: 'fish-room', order: 32, label: '鱼房间' }, SettingsPanel)
        })
      } catch (e) { console.warn('[fishroom] 设置分区注册失败', e) }
      return function () {
        try { stopSidebar && stopSidebar() } catch (e) { /* ignore */ }
        try { stopMain && stopMain() } catch (e) { /* ignore */ }
        try { stopSettings && stopSettings() } catch (e) { /* ignore */ }
      }
    }

    exports.apply = apply
    exports.inject = ['slots']
    exports.name = 'fishroom-client'
    return module.exports
  },
})
