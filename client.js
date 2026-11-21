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
    // 全部操作图标使用相同的线宽与 20px 绘制框，避免操作栏混用字符与 emoji。
    function UiGlyph(props) {
      var base = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
      if (props.name === 'search') return h('svg', base,
        h('circle', { cx: 10.8, cy: 10.8, r: 6.2 }),
        h('path', { d: 'm16 16 4.8 4.8' }))
      if (props.name === 'refresh') return h('svg', base,
        h('path', { d: 'M20 11a8 8 0 0 0-14.9-3.5L3.5 10' }),
        h('path', { d: 'M3.5 4.5V10H9' }),
        h('path', { d: 'M4 13a8 8 0 0 0 14.9 3.5L20.5 14' }),
        h('path', { d: 'M15 14h5.5v5.5' }))
      if (props.name === 'export') return h('svg', base,
        h('path', { d: 'M12 3v12' }),
        h('path', { d: 'm7.5 10.5 4.5 4.5 4.5-4.5' }),
        h('path', { d: 'M4 16v4h16v-4' }))
      return h('svg', base,
        h('path', { d: 'M4 6h16M4 12h16M4 18h16' }),
        h('circle', { cx: 9, cy: 6, r: 2, fill: 'var(--fr-rail)' }),
        h('circle', { cx: 15, cy: 12, r: 2, fill: 'var(--fr-rail)' }),
        h('circle', { cx: 10, cy: 18, r: 2, fill: 'var(--fr-rail)' }))
    }

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
      var settingsState = useState(false), settingsOpen = settingsState[0], setSettingsOpen = settingsState[1]
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
            h('span', { className: 'fr-brand-mark', 'aria-hidden': true },
              h('svg', { viewBox: '0 0 48 48', width: 34, height: 34, fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' },
                h('path', { d: 'M10 24c7-9 18-12 30-6-4 10-12 16-22 16-4 0-7-4-8-10Z' }),
                h('path', { d: 'M10 24 4 17v15l6-8Z' }),
                h('circle', { cx: 29.5, cy: 22, r: 1.8, fill: 'currentColor', stroke: 'none' }),
                h('path', { d: 'M19 29c4 1 8 0 11-3' })
              )
            ),
            h('div', null, h('div', { className: 'fr-brand-title' }, '鱼房间'), h('div', { className: 'fr-brand-sub' }, 'A PLACE TO CONNECT'))
          ),
          h('div', { className: 'fr-side-label' }, '我的房间 ', h('span', { className: 'fr-side-count' }, String(rooms.length).padStart(2, '0'))),
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
          h('div', { className: 'fr-side-foot' }, h('span', { className: 'fr-presence' + (isConnected ? ' is-on' : '') }), h('span', null, isConnected ? '房间通讯正常' : '正在连接房间'), h('span', { className: 'fr-side-foot-label' }, 'FISH / LIVE'))
        ),
        h('section', { className: 'fr-conversation', 'aria-label': '房间聊天' },
          h('header', { className: 'fr-chat-head' },
            h('div', { className: 'fr-chat-heading' },
              h('div', { className: 'fr-kicker' }, 'FISH ROOM', h('span', { className: 'fr-kicker-divider', 'aria-hidden': true }, ' / '), '正在交谈'),
              h('div', { className: 'fr-heading-line' },
                h('h1', null, room || '鱼房间'),
                h('span', { className: 'fr-status' + (isConnected ? ' is-on' : '') }, isConnected ? '已连接' : '未连接')
              ),
              h('div', { className: 'fr-subtitle' }, online.length + ' 人在线 · ' + (members.length || 0) + ' 位成员 · 人设：' + (cfg.personaLabel || '跟随智能体'))
            ),
            h('div', { className: 'fr-head-actions' },
              h('button', { type: 'button', className: 'fr-icon-button' + (searchOpen ? ' is-active' : ''), onClick: function () { if (searchOpen) closeSearch(); else setSearchOpen(true) }, title: '搜索聊天记录', 'aria-label': '搜索聊天记录' }, h(UiGlyph, { name: 'search' })),
              h('button', { type: 'button', className: 'fr-icon-button fr-refresh', onClick: reload, title: '刷新消息', 'aria-label': '刷新消息' }, h(UiGlyph, { name: 'refresh' })),
              h('button', { type: 'button', className: 'fr-text-button', onClick: function () { window.open('/fish-room/export?room=' + encodeURIComponent(room) + '&fmt=md', '_blank', 'noopener') }, title: '导出当前房间聊天记录' }, h(UiGlyph, { name: 'export' }), '导出记录'),
              h('button', { type: 'button', className: 'fr-text-button fr-settings-entry', onClick: function () { setSettingsOpen(true) }, title: '打开房间设置' }, h(UiGlyph, { name: 'settings' }), '房间设置')
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
          ),
          settingsOpen ? h('div', { className: 'fr-settings-overlay', role: 'dialog', 'aria-modal': true, 'aria-label': '鱼房间设置' },
            h(SettingsPanel, { embedded: true, onClose: function () { setSettingsOpen(false); reload() } })
          ) : null
        )
      )
    }

    // ── 插件设置：同一个组件同时服务于 DSH 设置分区与聊天内弹层 ──
    function SettingsPanel(props) {
      props = props || {}
      var source = useState(null), rooms = source[0], setRooms = source[1]
      var presetSource = useState([]), personaOptions = presetSource[0], setPersonaOptions = presetSource[1]
      var personaCategoryState = useState('standard'), personaCategory = personaCategoryState[0], setPersonaCategory = personaCategoryState[1]
      var personaCategories = [
        { id: 'standard', label: '常用' }, { id: 'tieba', label: '贴吧' },
        { id: 'thunder', label: '雷霆' }, { id: 'custom', label: '自定义' },
      ]
      var selectedState = useState(0), selected = selectedState[0], setSelected = selectedState[1]
      var statusState = useState(''), status = statusState[0], setStatus = statusState[1]
      var errorState = useState(false), isError = errorState[0], setIsError = errorState[1]
      var savingState = useState(false), saving = savingState[0], setSaving = savingState[1]
      var dirtyState = useState(false), dirty = dirtyState[0], setDirty = dirtyState[1]
      var visibleState = useState(false), showPass = visibleState[0], setShowPass = visibleState[1]
      var focusRef = useRef(null)
      var nextId = useRef(1)

      var personaGroupOf = function (room, choices) {
        if (!room) return 'standard'
        var id = room.personaPreset || (room.persona ? 'custom' : 'follow')
        var item = (choices || []).find(function (p) { return p.id === id })
        return item && item.group || 'standard'
      }

      var readSettings = useCallback(function () {
        setStatus('')
        return api('/fish-room/settings', { cache: 'no-store' }).then(function (j) {
          if (!j || !j.ok) throw new Error((j && j.error) || '无法读取房间设置')
          if (!Array.isArray(j.personas) || !j.personas.length) throw new Error('预置人设列表读取失败')
          setPersonaOptions(j.personas)
          setPersonaCategory(personaGroupOf((j.rooms || [])[0], j.personas))
          setSelected(0)
          setRooms((j.rooms || []).map(function (r) { return Object.assign({}, r, { _originalName: r.name, _passphrase: '', _key: 'room-' + nextId.current++ }) }))
          setDirty(false)
          return j
        }).catch(function (e) { setIsError(true); setStatus(e.message || '无法读取配置') })
      }, [])
      useEffect(function () { readSettings() }, [readSettings])
      useEffect(function () { if (focusRef.current) focusRef.current.focus() }, [])

      var update = function (index, key, value) {
        setRooms(function (current) {
          return current.map(function (r, i) {
            if (index !== i) return r
            var next = Object.assign({}, r)
            next[key] = value
            if (key === 'name' && r.topic === 'dsh-room-' + r.name) next.topic = 'dsh-room-' + String(value).trim()
            return next
          })
        })
        setDirty(true)
        setStatus('')
      }
      var textField = function (r, index, key, title, description, extra) {
        extra = extra || {}
        var id = 'fish-setting-' + index + '-' + key
        return h('div', { className: 'fr-field' + (extra.full ? ' fr-field-full' : '') },
          h('label', { htmlFor: id }, title),
          extra.multiline
            ? h('textarea', { id: id, rows: extra.rows || 3, value: extra.list ? (r[key] || []).join('\n') : (r[key] || ''),
                placeholder: extra.placeholder || '', onChange: function (e) { update(index, key, extra.list ? e.target.value.split('\n').map(function (v) { return v.trim() }).filter(Boolean) : e.target.value) } })
            : h('input', { id: id, type: extra.type || 'text', value: r[key] == null ? '' : r[key],
                min: extra.min, max: extra.max, placeholder: extra.placeholder || '',
                onChange: function (e) { update(index, key, extra.type === 'number' ? Number(e.target.value) : e.target.value) } }),
          description ? h('span', { className: 'fr-field-help' }, description) : null
        )
      }

      var addRoom = function () {
        setRooms(function (prev) {
          var used = new Set(prev.map(function (r) { return r.name }))
          var n = 1
          while (used.has('新房间-' + n)) n++
          setSelected(prev.length)
          setPersonaCategory('standard')
          return prev.concat([{ name: '新房间-' + n, _key: 'new-' + nextId.current++, _passphrase: '',
            _originalName: '', displayName: '', persona: '', personaPreset: 'follow', server: 'https://ntfy.sh', transport: 'ntfy',
            topic: '', allow: [], deny: [], owner: '', autoReply: true, maxRounds: 2, cooldownSec: 15,
            turnTimeoutSec: 180, provider: '', model: '', cwd: '' }])
        })
        setDirty(true)
        setStatus('')
        setShowPass(false)
      }
      var removeRoom = function () {
        if (!rooms || rooms.length < 2) { setIsError(true); setStatus('至少保留一个房间'); return }
        if (!window.confirm('删除这个房间的配置？保存后将退出该房间，历史记录仍保留在本地。')) return
        setRooms(function (prev) { return prev.filter(function (_, i) { return i !== selected }) })
        setSelected(function (value) { return Math.max(0, Math.min(value, rooms.length - 2)) })
        setDirty(true)
        setStatus('')
      }
      var validate = function () {
        var seen = {}
        for (var i = 0; i < rooms.length; i++) {
          var r = rooms[i]
          var name = String(r.name || '').trim()
          if (!name || name.length > 64 || /[\/\\?#\x00-\x1f]/.test(name) || name === '..') return '房间名称需要填写，且不能包含路径符号'
          if (seen[name]) return '房间名称不能重复：' + name
          seen[name] = true
          if (!/^https?:\/\/[^ \t\r\n]+$/i.test(String(r.server || ''))) return '请填写有效的中继地址（http:// 或 https://）'
          if (r.topic && /[\/\\?#\x00-\x1f]/.test(r.topic)) return '中继主题不能包含路径或查询符号'
          if (!r.displayName || !String(r.displayName).trim()) return '请填写房间「' + name + '」里的显示名字'
          if (r.maxRounds < 0 || r.maxRounds > 6 || !Number.isInteger(r.maxRounds)) return '最多来回轮次应在 0～6 之间'
          if (r.cooldownSec < 0 || r.cooldownSec > 300 || !Number.isInteger(r.cooldownSec)) return '接话冷却应在 0～300 秒之间'
          if (r.turnTimeoutSec < 15 || r.turnTimeoutSec > 600 || !Number.isInteger(r.turnTimeoutSec)) return '回答等待时间应在 15～600 秒之间'
          var personaId = r.personaPreset || (String(r.persona || '').trim() ? 'custom' : 'follow')
          if (!personaOptions.some(function (p) { return p.id === personaId })) return '请选择有效的聊天人设'
          if (String(r.persona || '').length > 2000) return '自定义聊天人设最多填写 2000 字'
          if (personaId === 'custom' && !String(r.persona || '').trim()) return '请先填写自定义聊天人设'
        }
        return ''
      }
      var save = function () {
        if (saving || !rooms) return
        var issue = validate()
        if (issue) { setIsError(true); setStatus(issue); return }
        setSaving(true); setStatus(''); setIsError(false)
        var payload = rooms.map(function (r) {
          var o = Object.assign({}, r)
          delete o._key
          delete o._passphrase
          delete o._originalName
          o.originalName = r._originalName || ''
          o.passphrase = r._passphrase || (r._originalName ? '******' : '')
          o.name = r.name.trim()
          o.displayName = r.displayName.trim()
          o.server = r.server.trim()
          o.topic = (r.topic || '').trim()
          return o
        })
        api('/fish-room/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rooms: payload }) })
          .then(function (j) {
            if (!j || !j.ok) throw new Error((j && j.error) || '保存失败')
            setPersonaOptions(Array.isArray(j.personas) ? j.personas : [])
          setRooms((j.rooms || []).map(function (r) { return Object.assign({}, r, { _originalName: r.name, _passphrase: '', _key: 'room-' + nextId.current++ }) }))
            setDirty(false); setIsError(false); setShowPass(false)
            setStatus('配置已保存并应用，连接状态会在页面中更新')
          }).catch(function (e) { setIsError(true); setStatus(e.message || '保存失败') })
          .then(function () { setSaving(false) })
      }

      var close = function () {
        if (dirty && !window.confirm('还有未保存的更改，确定退出设置吗？')) return
        if (props.onClose) props.onClose()
      }
      return h(React.Fragment, null,
        h('link', { rel: 'stylesheet', href: '/fish-room/ui.css' }),
        h('div', { className: 'fr-settings' + (props.embedded ? ' fr-settings-embedded' : '') },
          h('div', { className: 'fr-settings-heading' },
            h('div', null, h('div', { className: 'fr-kicker' }, 'FISH ROOM · SETTINGS'),
              h('h2', null, '鱼房间设置'),
              h('p', null, '管理聊天房间、连接方式、接话行为和成员权限。保存后会更新当前运行的插件。')),
            props.onClose ? h('button', { type: 'button', className: 'fr-settings-close', onClick: close, 'aria-label': '关闭房间设置' }, '×') : null
          ),
          !rooms
            ? h('div', { className: 'fr-settings-loading', role: 'status' },
              status ? h('div', { className: 'fr-settings-notice is-error' }, status,
                h('button', { type: 'button', onClick: readSettings }, '重试')) : '正在读取房间设置…')
            : h(React.Fragment, null,
              h('div', { className: 'fr-settings-toolbar' },
                h('div', { className: 'fr-settings-tabs', role: 'tablist', 'aria-label': '选择房间' },
                  rooms.map(function (r, i) {
                    return h('button', { key: r._key, type: 'button', role: 'tab', 'aria-selected': i === selected, className: 'fr-settings-tab' + (i === selected ? ' is-selected' : ''), onClick: function () { setSelected(i); setPersonaCategory(personaGroupOf(r, personaOptions)); setShowPass(false); setStatus('') } },
                      h('span', { className: 'fr-room-connection' + (r.connected ? ' is-on' : '') }),
                      r.name || '未命名房间')
                  })
                ),
                h('button', { type: 'button', className: 'fr-settings-add', onClick: addRoom }, '＋ 新建房间')
              ),
              rooms[selected] ? (function (r, i) {
                return h('div', { key: r._key, className: 'fr-settings-form', role: 'tabpanel' },
                  h('section', { className: 'fr-settings-card' },
                    h('div', { className: 'fr-settings-section-head' }, h('span', { className: 'fr-section-num' }, '01'),
                      h('div', null, h('h3', null, '房间信息'), h('p', null, '用于识别房间和聊天中的身份。'))),
                    h('div', { className: 'fr-settings-grid' },
                      textField(r, i, 'name', '房间名称', '参与者使用相同名称与口令才能通信。更改名称将进入新房间，原历史仍保存在本机。', { placeholder: '例如：海湾讨论' }),
                      textField(r, i, 'displayName', '我的显示名称', '聊天时其他成员看到的名字。', { placeholder: '例如：小鱼' }),
                      h('div', { className: 'fr-field fr-field-full' },
                        h('label', { htmlFor: 'fish-room-pass' }, '房间口令'),
                        h('div', { className: 'fr-password-row' },
                          h('input', { id: 'fish-room-pass', type: showPass ? 'text' : 'password', autoComplete: 'new-password',
                            value: r._passphrase || '', placeholder: r.hasPassphrase ? '已设置，留空表示保留原口令' : '建议设置共享口令',
                            onChange: function (e) { update(i, '_passphrase', e.target.value) } }),
                          h('button', { type: 'button', onClick: function () { setShowPass(!showPass) }, 'aria-label': showPass ? '隐藏口令' : '显示口令' }, showPass ? '隐藏' : '显示')),
                        h('span', { className: 'fr-field-help' }, '口令用于消息加密，请通过可信渠道与其他成员一致设置。'))
                    )
                  ),
                  h('section', { className: 'fr-settings-card' },
                    h('div', { className: 'fr-settings-section-head' }, h('span', { className: 'fr-section-num' }, '02'),
                      h('div', null, h('h3', null, '连接设置'), h('p', null, '配置消息传输位置。连接变更后，插件自动重新订阅。'))),
                    h('div', { className: 'fr-settings-grid' },
                      h('div', { className: 'fr-field' }, h('label', { htmlFor: 'fish-room-transport' }, '连接方式'),
                        h('select', { id: 'fish-room-transport', value: r.transport || 'ntfy', onChange: function (e) { update(i, 'transport', e.target.value) } },
                          h('option', { value: 'ntfy' }, 'ntfy 消息中继'),
                          h('option', { value: 'http' }, 'HTTP 自建中继'))),
                      textField(r, i, 'server', '中继地址', 'ntfy 可使用默认服务，自建时填写服务地址。', { placeholder: 'https://ntfy.sh' }),
                      textField(r, i, 'topic', '中继主题（可选）', '留空时按照房间名称自动生成。', { full: true, placeholder: '自动：dsh-room-房间名' })
                    )
                  ),
                  h('section', { className: 'fr-settings-card' },
                    h('div', { className: 'fr-settings-section-head' }, h('span', { className: 'fr-section-num' }, '03'),
                      h('div', null, h('h3', null, '聊天与自动接话'), h('p', null, '控制 Agent 是否自动参与房间对话和回复频率。'))),
                    h('label', { className: 'fr-settings-switch' },
                      h('span', null, h('strong', null, '自动接话'), h('small', null, '开启后，Agent 根据房间消息主动生成回复。')),
                      h('input', { type: 'checkbox', role: 'switch', checked: !!r.autoReply,
                        onChange: function (e) { update(i, 'autoReply', e.target.checked) } })
                    ),
                    h('div', { className: 'fr-persona' },
                      h('div', { className: 'fr-persona-heading' },
                        h('div', null,
                          h('h4', { id: 'fish-persona-title' }, '聊天人设'),
                          h('p', null, '为本机智能体选择聊天风格。每个房间独立设置，其他成员不受影响。')),
                        h('span', { className: 'fr-persona-current' }, '当前选择 · ' +
                          ((personaOptions.find(function (p) { return p.id === (r.personaPreset || (r.persona ? 'custom' : 'follow')) }) || {}).label || '跟随智能体'))
                      ),
                      h('div', { className: 'fr-persona-categories', role: 'tablist', 'aria-label': '聊天人设类型' },
                        personaCategories.map(function (cat) {
                          var count = personaOptions.filter(function (p) { return p.group === cat.id }).length
                          return h('button', { key: cat.id, type: 'button', role: 'tab',
                            'aria-selected': personaCategory === cat.id,
                            className: 'fr-persona-category' + (personaCategory === cat.id ? ' is-active' : ''),
                            onClick: function () { setPersonaCategory(cat.id) } },
                            cat.label, h('span', { className: 'fr-persona-category-count' }, String(count)))
                        })
                      ),
                      h('fieldset', { className: 'fr-persona-choices', 'aria-labelledby': 'fish-persona-title' },
                        personaOptions.filter(function (p) { return p.group === personaCategory }).map(function (p) {
                          var active = (r.personaPreset || (r.persona ? 'custom' : 'follow')) === p.id
                          return h('label', { key: p.id, className: 'fr-persona-choice' + (active ? ' is-selected' : '') },
                            h('span', { className: 'fr-persona-choice-top' },
                              h('input', { type: 'radio', name: 'fish-persona-' + r._key, value: p.id,
                                checked: active, onChange: function () { update(i, 'personaPreset', p.id) } }),
                              h('strong', null, p.label)),
                            h('span', { className: 'fr-persona-desc' }, p.description),
                            h('span', { className: 'fr-persona-example' }, '语气示例：' + p.example)
                          )
                        })
                      ),
                      (r.personaPreset || (r.persona ? 'custom' : 'follow')) === 'custom'
                        ? h('div', { className: 'fr-persona-custom' },
                          h('label', { htmlFor: 'fish-setting-' + i + '-persona' }, '自己编写人设'),
                          h('textarea', { id: 'fish-setting-' + i + '-persona', rows: 5,
                            maxLength: 2000, value: r.persona || '',
                            placeholder: '例如：你是一位沉稳、有幽默感的聊天伙伴。说话自然，擅长倾听，偶尔提出有趣的问题。回复保持简洁，不要反复自我介绍。',
                            onChange: function (e) { update(i, 'persona', e.target.value) } }),
                          h('div', { className: 'fr-persona-custom-foot' },
                            h('span', null, '保存后用于下一轮接话；切回自定义时仍可继续编辑先前填写的内容。'),
                            h('span', { className: 'fr-persona-count' }, String((r.persona || '').length) + ' / 2000')
                          )
                        ) : null
                    ),
                    h('div', { className: 'fr-settings-grid' },
                      textField(r, i, 'maxRounds', '最多来回轮次', '范围 0～6，限制连续对聊。', { type: 'number', min: 0, max: 6 }),
                      textField(r, i, 'cooldownSec', '接话冷却（秒）', '范围 0～300，避免短时间连续接话。', { type: 'number', min: 0, max: 300 })
                    )
                  ),
                  h('details', { className: 'fr-settings-card fr-settings-disclosure' },
                    h('summary', null, h('span', { className: 'fr-section-num' }, '04'), h('span', null, h('strong', null, '成员与权限'), h('small', null, '管理成员访问与消息过滤'))),
                    h('div', { className: 'fr-settings-grid' },
                      textField(r, i, 'owner', '房间主人（可选）', '显示名称须与实际发言者一致。'),
                      textField(r, i, 'allow', '允许自动接话的成员', '每行一个名字；留空则允许所有成员。', { multiline: true, list: true }),
                      textField(r, i, 'deny', '不接话成员', '每行一个名字。', { multiline: true, list: true })
                    )
                  ),
                  h('details', { className: 'fr-settings-card fr-settings-disclosure' },
                    h('summary', null, h('span', { className: 'fr-section-num' }, '05'), h('span', null, h('strong', null, '高级设置'), h('small', null, '模型和运行环境，通常沿用 DSH 默认配置即可'))),
                    h('div', { className: 'fr-settings-grid' },
                      textField(r, i, 'provider', '模型提供方', '可留空，沿用 DSH 默认。'),
                      textField(r, i, 'model', '模型名称', '可留空，沿用 DSH 默认。'),
                      textField(r, i, 'cwd', '工作目录', '默认使用 DSH_HOME，以读取 AGENTS.md。', { full: true }),
                      textField(r, i, 'turnTimeoutSec', '回答等待时间（秒）', '范围 15～600。', { type: 'number', min: 15, max: 600 })
                    )
                  ),
                  h('div', { className: 'fr-settings-danger' },
                    h('span', null, '不再需要这个房间？'),
                    h('button', { type: 'button', disabled: rooms.length < 2, onClick: removeRoom }, '移除房间')
                  )
                )
              })(rooms[selected], selected) : null,
              h('div', { className: 'fr-settings-savebar' },
                h('span', { className: 'fr-settings-feedback' + (isError ? ' is-error' : ''), role: isError ? 'alert' : 'status' }, status || (dirty ? '有尚未保存的更改' : '配置已同步')),
                h('div', { className: 'fr-settings-save-actions' },
                  dirty ? h('button', { type: 'button', className: 'fr-settings-cancel', disabled: saving, onClick: readSettings }, '撤销更改') : null,
                  h('button', { type: 'button', className: 'fr-settings-submit', disabled: saving || !dirty, onClick: save }, saving ? '正在保存…' : '保存并应用')
                )
              )
            )
        )
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
