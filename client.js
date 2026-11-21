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
        var src = x.url || (x.data ? 'data:' + (x.type || 'application/octet-stream') + ';base64,' + x.data : '')
        if (!src) return null
        if ((x.type || '').indexOf('image/') === 0) {
          return h('img', { key: i, src: src, style: s.img, alt: x.name || 'image' })
        }
        if ((x.type || '').indexOf('audio/') === 0) {
          return h('div', { key: i, style: s.media },
            h('audio', { controls: true, src: src }),
            h('a', { href: src, target: '_blank', rel: 'noopener noreferrer', style: { marginLeft: 8, color: C.accent } }, x.name || '语音'))
        }
        return h('div', { key: i, style: s.media },
          h('a', { href: src, target: '_blank', rel: 'noopener noreferrer', style: { color: C.accent } }, '📎 ' + (x.name || '文件')))
      })
    }

    // ── 聊天工作区：两个入口共用 /fish-room/ui.css 的视觉系统 ──
    function ChatPanel() {
      var state = useState({ ok: false, rooms: [], messages: [], members: [], me: { id: '' } })
      var data = state[0], setData = state[1]
      var roomState = useState(''), room = roomState[0], setRoom = roomState[1]
      var draftState = useState(''), draft = draftState[0], setDraft = draftState[1]
      var busyState = useState(false), busy = busyState[0], setBusy = busyState[1]
      var fileState = useState(null), selectedFile = fileState[0], setSelectedFile = fileState[1]
      var searchState = useState(false), searchOpen = searchState[0], setSearchOpen = searchState[1]
      var queryState = useState(''), query = queryState[0], setQuery = queryState[1]
      var resultState = useState(null), results = resultState[0], setResults = resultState[1]
      var totalState = useState(0), searchTotal = totalState[0], setSearchTotal = totalState[1]
      var searchingState = useState(false), searching = searchingState[0], setSearching = searchingState[1]
      var errorState = useState(''), error = errorState[0], setError = errorState[1]
      var unreadState = useState(0), unread = unreadState[0], setUnread = unreadState[1]
      var memberState = useState(false), membersExpanded = memberState[0], setMembersExpanded = memberState[1]
      var fileRef = useRef(null), textRef = useRef(null), listRef = useRef(null), searchRef = useRef(null)
      var activeRoomRef = useRef(room), meRef = useRef(''), busyRef = useRef(false)
      var draftsRef = useRef({}), seenRef = useRef({}), atBottomRef = useRef(true)
      activeRoomRef.current = room
      meRef.current = data.me && data.me.id

      var reload = useCallback(function () {
        var requested = room
        return api('/fish-room/state?room=' + encodeURIComponent(requested), { cache: 'no-store' })
          .then(function (j) {
            if (j && j.ok && requested === activeRoomRef.current) { setData(j); return j }
            if (j && j.error && requested === activeRoomRef.current) setError(j.error)
            return j
          }).catch(function (e) {
            if (requested === activeRoomRef.current) setError('连接失败，请检查房间服务')
            return null
          })
      }, [room])

      useEffect(function () {
        if (!room && data.rooms && data.rooms.length) setRoom(data.rooms[0].name)
      }, [data.rooms, room])

      useEffect(function () {
        reload()
        var timer = setInterval(reload, 15000)
        return function () { clearInterval(timer) }
      }, [reload])

      useEffect(function () {
        if (!room) return
        var es = new EventSource('/fish-room/events?room=' + encodeURIComponent(room))
        es.onmessage = function (event) {
          var p
          try { p = JSON.parse(event.data) } catch (e) { return }
          if (p.type === 'message') {
            var m = p.message
            if (m && m.from !== meRef.current && !seenRef.current[room + ':' + m.id]) {
              seenRef.current[room + ':' + m.id] = 1
              if (document.hidden || !atBottomRef.current) setUnread(function (n) { return n + 1 })
              if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('鱼房间 · ' + room, { body: (m.fromName || '') + '：' + String(m.text || '').slice(0, 80) })
              }
            }
            reload()
          } else if (p.type === 'status' || p.type === 'draft') reload()
        }
        return function () { es.close() }
      }, [room, reload])

      useEffect(function () {
        var visible = function () { if (!document.hidden && atBottomRef.current) setUnread(0) }
        document.addEventListener('visibilitychange', visible)
        return function () { document.removeEventListener('visibilitychange', visible) }
      }, [])

      var msgs = results === null ? (data.messages || []) : results
      var lastId = msgs.length ? String(msgs[msgs.length - 1].id || '') : ''
      useEffect(function () {
        var el = listRef.current
        if (el && (atBottomRef.current || results !== null)) {
          el.scrollTop = results === null ? el.scrollHeight : 0
        }
      }, [room, lastId, msgs.length, results])
      useEffect(function () { if (searchOpen && searchRef.current) searchRef.current.focus() }, [searchOpen])

      var changeRoom = function (name) {
        if (name === room) return
        draftsRef.current[room] = draft
        setDraft(draftsRef.current[name] || '')
        setRoom(name)
        setSearchOpen(false); setQuery(''); setResults(null)
        setError(''); setUnread(0)
        atBottomRef.current = true
        setMembersExpanded(false)
        setSelectedFile(null)
        if (fileRef.current) fileRef.current.value = ''
        setSearching(false)
      }

      var send = function () {
        var text = draft.trim()
        var file = selectedFile
        if ((!text && !file) || busyRef.current || !room) return
        busyRef.current = true
        setBusy(true); setError('')
        var upload = !file ? Promise.resolve([]) : new Promise(function (resolve, reject) {
          var reader = new FileReader()
          reader.onload = function () {
            api('/fish-room/media', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ room: room, name: file.name, type: file.type, data: String(reader.result || '').split(',')[1] || '' }),
            }).then(function (up) {
              if (!up || !up.ok || !up.media) throw new Error((up && up.error) || '附件上传失败')
              resolve([up.media])
            }).catch(reject)
          }
          reader.onerror = function () { reject(new Error('附件读取失败')) }
          reader.readAsDataURL(file)
        })
        upload.then(function (media) {
          return api('/fish-room/send', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: room, text: text, media: media }),
          })
        }).then(function (response) {
          if (!response || !response.ok) throw new Error((response && response.error) || '发送失败')
          draftsRef.current[room] = ''
          if (activeRoomRef.current === room) {
            setDraft('')
            setSelectedFile(null)
            if (fileRef.current) fileRef.current.value = ''
            setSearchOpen(false); setQuery(''); setResults(null)
            atBottomRef.current = true
          }
          return reload()
        }).catch(function (e) {
          setError(e && e.message ? e.message : '发送失败，请重试')
        }).then(function () {
          busyRef.current = false
          setBusy(false)
          if (textRef.current) textRef.current.focus()
        })
      }

      var doSearch = function () {
        var searchTerm = query.trim(), requested = room
        if (!searchTerm) { setResults(null); setSearchTotal(0); return }
        setSearching(true); setError('')
        api('/fish-room/history?room=' + encodeURIComponent(requested) + '&limit=200&q=' + encodeURIComponent(searchTerm))
          .then(function (j) {
            if (requested !== activeRoomRef.current) return
            if (!j || !j.ok) throw new Error((j && j.error) || '搜索失败')
            setResults(j.messages || [])
            setSearchTotal(j.total || 0)
          }).catch(function (e) { if (requested === activeRoomRef.current) setError(e.message || '搜索失败') })
          .then(function () { if (requested === activeRoomRef.current) setSearching(false) })
      }

      var closeSearch = function () {
        setSearchOpen(false); setResults(null); setQuery(''); setSearchTotal(0); setError('')
        atBottomRef.current = true
      }
      var showLatest = function () {
        atBottomRef.current = true
        setUnread(0)
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
      }
      var members = data.members || []
      var online = members.filter(function (m) { return m.online })
      var cfg = data.config || {}
      var rooms = data.rooms || []
      var myName = data.me && data.me.name || '我'
      var isConnected = !!cfg.connected

      return h('div', { className: 'fr-root' },
        h('link', { rel: 'stylesheet', href: '/fish-room/ui.css' }),
        h('aside', { className: 'fr-sidebar' + (membersExpanded ? ' fr-members-open' : '') },
          h('div', { className: 'fr-brand' },
            h('span', { className: 'fr-brand-mark', 'aria-hidden': true }, '≈'),
            h('div', null, h('div', { className: 'fr-brand-title' }, '鱼房间'), h('div', { className: 'fr-brand-sub' }, 'AGENT COMMON ROOM'))
          ),
          h('div', { className: 'fr-side-label' }, '我的房间 ', h('span', null, rooms.length)),
          h('nav', { className: 'fr-rooms', 'aria-label': '切换房间' },
            rooms.map(function (r) {
              var count = r.name === room ? members.filter(function (m) { return m.online }).length : null
              return h('button', {
                key: r.name, type: 'button', className: 'fr-room' + (r.name === room ? ' is-active' : ''),
                'aria-current': r.name === room ? 'page' : undefined,
                title: '进入房间 ' + r.name, onClick: function () { changeRoom(r.name) },
              }, h('span', { className: 'fr-room-glyph', 'aria-hidden': true }, '#'),
                 h('span', { className: 'fr-room-name' }, r.name),
                 h('span', { className: 'fr-room-connection' + (r.connected ? ' is-on' : ''), title: r.connected ? '已连接' : '未连接' }))
            })
          ),
          h('div', { className: 'fr-members-head' },
            h('div', { className: 'fr-side-label' }, '房间成员 ', h('span', null, online.length + ' 在线')),
            h('button', { type: 'button', className: 'fr-mobile-members', onClick: function () { setMembersExpanded(!membersExpanded) }, 'aria-expanded': membersExpanded }, membersExpanded ? '收起' : '查看')
          ),
          h('div', { className: 'fr-members' },
            members.length ? members.map(function (m, i) {
              return h('div', { className: 'fr-member', key: m.name + ':' + i },
                h('span', { className: 'fr-avatar fr-avatar-small' }, String(m.name || '?').slice(0, 1).toUpperCase()),
                h('span', { className: 'fr-member-name' }, m.name),
                h('span', { className: 'fr-member-status' + (m.online ? ' is-on' : ''), title: m.online ? '在线' : '离线' }))
            }) : h('div', { className: 'fr-members-empty' }, '成员将在首次发言后出现')
          ),
          h('div', { className: 'fr-side-foot' }, h('span', { className: 'fr-presence' + (isConnected ? ' is-on' : '') }), isConnected ? '消息中继已连接' : '等待中继连接')
        ),
        h('section', { className: 'fr-conversation', 'aria-label': '房间聊天' },
          h('header', { className: 'fr-chat-head' },
            h('div', { className: 'fr-chat-heading' },
              h('div', { className: 'fr-kicker' }, '正在交谈'),
              h('div', { className: 'fr-heading-line' },
                h('h1', null, room || '鱼房间'),
                h('span', { className: 'fr-status' + (isConnected ? ' is-on' : '') }, isConnected ? '已连接' : '未连接')
              ),
              h('div', { className: 'fr-subtitle' }, online.length + ' 人在线 · ' + (members.length || 0) + ' 位成员')
            ),
            h('div', { className: 'fr-head-actions' },
              h('button', { type: 'button', className: 'fr-icon-button' + (searchOpen ? ' is-active' : ''), onClick: function () { if (searchOpen) closeSearch(); else setSearchOpen(true) }, title: '搜索聊天记录', 'aria-label': '搜索聊天记录' }, '⌕'),
              h('button', { type: 'button', className: 'fr-icon-button fr-refresh', onClick: reload, title: '刷新消息', 'aria-label': '刷新消息' }, '↻'),
              h('button', { type: 'button', className: 'fr-text-button', onClick: function () { window.open('/fish-room/export?room=' + encodeURIComponent(room) + '&fmt=md', '_blank', 'noopener') }, title: '导出当前房间聊天记录' }, '导出记录')
            )
          ),
          searchOpen ? h('form', { className: 'fr-search', onSubmit: function (e) { e.preventDefault(); doSearch() } },
            h('input', { ref: searchRef, type: 'search', value: query, placeholder: '搜索消息内容或发言者', 'aria-label': '搜索消息', onChange: function (e) { setQuery(e.target.value); if (!e.target.value) setResults(null) } }),
            h('button', { type: 'submit', className: 'fr-search-submit', disabled: searching }, searching ? '搜索中' : '查找'),
            h('button', { type: 'button', className: 'fr-close-search', onClick: closeSearch }, '关闭'),
            results !== null ? h('span', { className: 'fr-search-count', role: 'status' }, '找到 ' + searchTotal + ' 条' + (searchTotal > msgs.length ? '，显示最近 ' + msgs.length + ' 条' : '')) : null
          ) : null,
          h('div', { className: 'fr-message-area', ref: listRef, role: 'log', 'aria-live': 'polite', 'aria-label': '聊天消息',
            onScroll: function (e) {
              var el = e.currentTarget
              atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
              if (atBottomRef.current && !document.hidden) setUnread(0)
            }
          },
            !data.ok ? h('div', { className: 'fr-empty' }, h('strong', null, '正在连接房间'), h('p', null, '聊天记录将在连接成功后显示。')) :
            !msgs.length ? h('div', { className: 'fr-empty' },
              h('span', { className: 'fr-empty-mark', 'aria-hidden': true }, '≈'),
              h('strong', null, results !== null ? '没有找到相关消息' : '从一句话开始'),
              h('p', null, results !== null ? '换个关键词试试，或关闭搜索查看全部消息。' : '房间已经准备好。发出第一条消息，其他成员就能加入交谈。')
            ) : msgs.map(function (m, i) {
              var mine = m.from === (data.me && data.me.id)
              var role = m.kind === 'agent' ? '智能体' : m.kind === 'guest' ? '访客' : '成员'
              var day = new Date(m.ts).toDateString()
              var prevDay = i ? new Date(msgs[i - 1].ts).toDateString() : ''
              var separator = day !== prevDay ? h('div', { className: 'fr-day', key: 'day:' + i }, new Date(m.ts).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })) : null
              return h(React.Fragment, { key: m.id || i },
                separator,
                h('article', { className: 'fr-message' + (mine ? ' fr-mine' : '') },
                  !mine ? h('span', { className: 'fr-avatar', 'aria-hidden': true }, String(m.fromName || '?').slice(0, 1).toUpperCase()) : null,
                  h('div', { className: 'fr-message-content' },
                    h('div', { className: 'fr-message-meta' },
                      h('strong', null, mine ? myName : (m.fromName || '未知成员')),
                      !mine ? h('span', { className: 'fr-role' }, role) : null,
                      h('time', { dateTime: m.ts ? new Date(m.ts).toISOString() : undefined }, fmtTime(m.ts))
                    ),
                    h('div', { className: 'fr-bubble' }, m.text || '', mediaNodes(m))
                  )
                )
              )
            })
          ),
          unread > 0 && results === null ? h('button', { type: 'button', className: 'fr-new-messages', onClick: showLatest }, unread + ' 条新消息 · 跳到最新') : null,
          h('div', { className: 'fr-bottom' },
            cfg.typing ? h('div', { className: 'fr-typing', role: 'status' },
              h('span', { className: 'fr-typing-dots', 'aria-hidden': true }, '•••'),
              cfg.draft ? String(cfg.draft).slice(0, 220) : '有成员正在思考…'
            ) : null,
            error ? h('div', { className: 'fr-error', role: 'alert' }, error, h('button', { type: 'button', onClick: function () { setError('') }, 'aria-label': '关闭错误提示' }, '×')) : null,
            h('div', { className: 'fr-composer' },
              selectedFile ? h('div', { className: 'fr-attachment' },
                h('span', null, '附件 · ' + selectedFile.name),
                h('button', { type: 'button', onClick: function () { setSelectedFile(null); if (fileRef.current) fileRef.current.value = '' }, disabled: busy, 'aria-label': '移除附件' }, '移除')
              ) : null,
              h('textarea', { ref: textRef, value: draft, disabled: busy, rows: 2,
                placeholder: '向房间发送消息…', 'aria-label': '输入聊天消息',
                onChange: function (e) { setDraft(e.target.value); draftsRef.current[room] = e.target.value },
                onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }
              }),
              h('div', { className: 'fr-compose-actions' },
                h('div', { className: 'fr-compose-left' },
                  h('button', { type: 'button', className: 'fr-attach-button', disabled: busy,
                    onClick: function () { if (fileRef.current) fileRef.current.click() }, 'aria-label': '添加附件' }, '＋', h('span', null, '附件')),
                  h('input', { ref: fileRef, type: 'file', className: 'fr-file-input', 'aria-label': '选择附件', onChange: function (e) { setSelectedFile(e.target.files && e.target.files[0] || null) } }),
                  h('span', { className: 'fr-compose-hint' }, 'Enter 发送 · Shift + Enter 换行')
                ),
                h('button', { type: 'button', className: 'fr-send', disabled: busy || (!draft.trim() && !selectedFile) || !room, onClick: send }, busy ? '发送中…' : '发送', h('span', { 'aria-hidden': true }, ' ↗'))
              )
            )
          )
        )
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
