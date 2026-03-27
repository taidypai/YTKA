import { useState, useEffect, useRef } from 'react'

const SERVER = 'http://localhost:5000'
const KATE_CLIENT_ID = '2685278'
const VK_REDIRECT_URI = 'https://oauth.vk.com/blank.html'

const VK_SCREENS = {
  LANDING: 'landing',
  AUTH: 'auth',
  MAIN: 'main',
}

function buildOAuthUrl() {
  return `https://oauth.vk.com/authorize?client_id=${KATE_CLIENT_ID}` +
    `&scope=wall,offline` +
    `&redirect_uri=${encodeURIComponent(VK_REDIRECT_URI)}` +
    `&display=page&response_type=token&v=5.131`
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function initials(a) {
  if (!a) return '?'
  return ((a.first_name || '')[0] || '') + ((a.last_name || '')[0] || '')
}

export default function VkFeed() {
  const [screen, setScreen] = useState(VK_SCREENS.LANDING)
  const [vkToken, setVkToken] = useState(null)
  const [authUrl, setAuthUrl] = useState('')
  const [authError, setAuthError] = useState('')
  const [serverOnline, setServerOnline] = useState(null)
  const [groupInput, setGroupInput] = useState('')
  const [groupTitle, setGroupTitle] = useState('—')
  const [count, setCount] = useState('10')
  const [filter, setFilter] = useState('others')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [status, setStatus] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [posts, setPosts] = useState([])
  const [feedError, setFeedError] = useState('')
  const [loadingPosts, setLoadingPosts] = useState(false)

  const autoTimerRef = useRef(null)

  const checkServer = async () => {
    try {
      const r = await fetch(`${SERVER}/api/health`, { signal: AbortSignal.timeout(3000) })
      const d = await r.json()
      if (d.ok) { setServerOnline(true); return true }
    } catch {}
    setServerOnline(false)
    return false
  }

  useEffect(() => {
    if (screen === VK_SCREENS.MAIN) checkServer()
  }, [screen])

  useEffect(() => {
    clearInterval(autoTimerRef.current)
    if (autoRefresh && vkToken) {
      autoTimerRef.current = setInterval(() => loadPosts(true), 60000)
    }
    return () => clearInterval(autoTimerRef.current)
  }, [autoRefresh, vkToken])

  const startAuth = () => {
    setScreen(VK_SCREENS.AUTH)
    openOAuth()
  }

  const openOAuth = () => {
    window.open(buildOAuthUrl(), '_blank')
    setAuthError('')
    setAuthUrl('')
  }

  const extractToken = () => {
    const raw = authUrl.trim()
    setAuthError('')
    let hash = ''
    try {
      const url = new URL(raw)
      hash = url.hash.substring(1)
    } catch {
      hash = raw.startsWith('#') ? raw.substring(1) : raw
    }
    const params = new URLSearchParams(hash)
    const token = params.get('access_token')
    if (!token) {
      setAuthError('Токен не найден. Убедись, что скопировал ссылку полностью, включая часть после #')
      return
    }
    setVkToken(token)
    setScreen(VK_SCREENS.MAIN)
  }

  const logout = () => {
    setVkToken(null)
    clearInterval(autoTimerRef.current)
    setPosts([])
    setFeedError('')
    setStatus('')
    setGroupInput('')
    setGroupTitle('—')
    setScreen(VK_SCREENS.LANDING)
  }

  const loadPosts = async (silent = false) => {
    if (!groupInput.trim()) {
      setStatus('Введи ссылку или имя группы')
      return
    }
    if (!vkToken) { logout(); return }

    if (!silent) {
      setLoadingPosts(true)
      setPosts([])
      setFeedError('')
      let g = groupInput.trim()
      for (const p of ['https://vk.com/', 'http://vk.com/', 'vk.com/']) {
        if (g.startsWith(p)) { g = g.slice(p.length); break }
      }
      setGroupTitle(g.replace(/\//g, ''))
    }

    const ok = await checkServer()
    if (!ok) {
      setStatusLoading(false)
      setStatus('')
      setFeedError('Сервер не запущен. Запусти в терминале:\npip install flask flask-cors requests\npython server.py')
      setLoadingPosts(false)
      return
    }

    setStatusLoading(true)
    setStatus('Загружаю посты...')

    try {
      const url = `${SERVER}/api/posts?count=${count}&filter=${filter}` +
        `&group=${encodeURIComponent(groupInput)}&token=${encodeURIComponent(vkToken)}`
      const r = await fetch(url)
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)

      const now = new Date().toLocaleTimeString('ru-RU')
      setPosts(d.posts)
      setFeedError('')
      setStatusLoading(false)
      setStatus(d.posts.length
        ? `Обновлено в ${now} — показано ${d.posts.length} постов`
        : `Обновлено в ${now} — 0 постов`)
    } catch (e) {
      setStatusLoading(false)
      setStatus('')
      setFeedError('Ошибка: ' + e.message)
    } finally {
      setLoadingPosts(false)
    }
  }

  // ── ЛЕНДИНГ ──────────────────────────────────────────────────────────────
  if (screen === VK_SCREENS.LANDING) {
    return (
      <div style={v.landing}>
        <p style={v.landingLogo}><span style={{ color: '#4f7fff' }}>VK</span>FEED</p>
        <h1 style={v.landingTitle}>Смотри посты<br />любой группы</h1>
        <p style={v.landingSub}>Авторизуйся через VK и просматривай публикации участников сообщества без лишнего шума.</p>
        <button style={v.btnStart} onClick={startAuth}>НАЧАТЬ</button>
        <p style={v.landingHint}>Требуется запущенный <code style={{ fontSize: 11, color: '#555' }}>server.py</code></p>
      </div>
    )
  }

  // ── АВТОРИЗАЦИЯ ───────────────────────────────────────────────────────────
  if (screen === VK_SCREENS.AUTH) {
    return (
      <div style={v.authScreen}>
        <div style={v.authIcon}>🔑</div>
        <h2 style={v.authTitle}>Авторизация VK</h2>
        <p style={v.authSub}>
          После входа VK перенаправит тебя на пустую страницу.<br />
          Скопируй <strong style={{ color: '#f0f0f0' }}>полную ссылку</strong> из адресной строки и вставь сюда.
        </p>
        <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            style={v.groupInput}
            type="text"
            placeholder="https://oauth.vk.com/blank.html#access_token=..."
            value={authUrl}
            onChange={(e) => setAuthUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && extractToken()}
            autoFocus
          />
          <button style={{ ...v.btnLoad, padding: '12px', width: '100%' }} onClick={extractToken}>ВОЙТИ</button>
        </div>
        {authError && <p style={{ color: '#e07070', fontSize: 13 }}>{authError}</p>}
        <button style={v.btnRetry} onClick={openOAuth}>Открыть окно авторизации снова</button>
        <button style={{ ...v.btnRetry, marginTop: 4 }} onClick={() => setScreen(VK_SCREENS.LANDING)}>← Назад</button>
      </div>
    )
  }

  // ── ОСНОВНОЙ ИНТЕРФЕЙС ────────────────────────────────────────────────────
  return (
    <div style={v.mainWrap}>
      <header style={v.header}>
        <span style={v.logo}><span style={{ color: '#4f7fff' }}>VK</span>FEED</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#777' }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: serverOnline === null ? '#555' : serverOnline ? '#3ecf5e' : '#e05050',
              boxShadow: serverOnline ? '0 0 6px #3ecf5e88' : 'none',
            }} />
            {serverOnline === null ? 'проверка...' : serverOnline ? 'сервер работает' : 'сервер недоступен'}
          </div>
          <button style={v.btnLogout} onClick={logout}>ВЫЙТИ</button>
        </div>
      </header>

      <main style={v.main}>
        <p style={v.pageTitle}>Посты участников сообщества</p>
        <h1 style={v.groupName}>{groupTitle}</h1>

        <div style={v.groupInputRow}>
          <input
            style={v.groupInput}
            type="text"
            placeholder="Ссылка или короткое имя: vk.com/club... или club..."
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadPosts()}
          />
          <button style={v.btnLoad} onClick={() => loadPosts()}>НАЙТИ</button>
        </div>

        <div style={v.controls}>
          <select style={v.select} value={count} onChange={(e) => setCount(e.target.value)}>
            <option value="5">5 постов</option>
            <option value="10">10 постов</option>
            <option value="20">20 постов</option>
            <option value="50">50 постов</option>
          </select>
          <select style={v.select} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="others">Посты участников</option>
            <option value="owner">Посты сообщества</option>
            <option value="all">Все посты</option>
          </select>
          <button style={v.btnLoad} onClick={() => loadPosts()} disabled={loadingPosts}>ЗАГРУЗИТЬ</button>
        </div>

        <div style={v.autoRow}>
          <input type="checkbox" id="vkAutoRefresh" checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f7fff' }} />
          <label htmlFor="vkAutoRefresh" style={{ cursor: 'pointer' }}>Автообновление каждые 60 сек</label>
        </div>

        {(status || statusLoading) && (
          <div style={v.status}>
            {statusLoading && <div style={v.spinner} />}
            <span>{status}</span>
          </div>
        )}

        {feedError && (
          <div style={v.errorMsg}>
            {feedError.split('\n').map((line, i) => (
              <span key={i}>{i > 0 ? <><br /><code style={v.code}>{line}</code></> : line}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.length === 0 && !feedError && !statusLoading && status && (
            <div style={v.empty}>Постов не найдено. Стена закрыта или пусто.</div>
          )}
          {posts.map((post, index) => {
            const a = post.author
            const name = a ? `${a.first_name} ${a.last_name}`.trim() : `id${post.from_id}`
            const profileLink = `https://vk.com/id${post.from_id}`
            const text = (post.text || '').trim()
            return (
              <div key={post.id || index} style={v.postCard}>
                <div style={v.postHeader}>
                  <div style={v.avatar}>
                    <a href={profileLink} target="_blank" rel="noreferrer" style={{ display: 'contents' }}>
                      {a?.photo_50
                        ? <img src={a.photo_50} alt={initials(a)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        : initials(a)}
                    </a>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a href={profileLink} target="_blank" rel="noreferrer" style={v.authorName}>{name}</a>
                    <div style={v.postDate}>{formatDate(post.date)}</div>
                  </div>
                  <span style={v.postIndex}>#{index + 1}</span>
                </div>
                {text
                  ? <div style={v.postText}>{text}</div>
                  : <div style={v.postNoText}>Пост без текста</div>}
                {post.photo && (
                  <div style={{ marginTop: 14 }}>
                    <img src={post.photo} alt="фото" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

const v = {
  landing: {
    minHeight: '60vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '40px 24px', gap: 0,
  },
  landingLogo: {
    fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 800,
    letterSpacing: '0.14em', color: '#777', textTransform: 'uppercase', marginBottom: 32,
  },
  landingTitle: {
    fontFamily: "'Unbounded', sans-serif",
    fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 800, lineHeight: 1.1,
    color: '#f0f0f0', marginBottom: 20,
  },
  landingSub: { fontSize: 15, color: '#777', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 48px' },
  btnStart: {
    background: '#4f7fff', color: '#fff', border: 'none',
    borderRadius: 12, padding: '16px 40px',
    fontFamily: "'Unbounded', sans-serif", fontSize: 13, fontWeight: 800,
    letterSpacing: '0.08em', cursor: 'pointer',
    boxShadow: '0 0 32px rgba(79,127,255,0.25)',
  },
  landingHint: { marginTop: 20, fontSize: 12, color: '#444' },
  authScreen: {
    minHeight: '60vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: '40px 24px', gap: 20,
  },
  authIcon: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'rgba(79,127,255,0.12)', border: '1px solid rgba(79,127,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, marginBottom: 8,
  },
  authTitle: {
    fontFamily: "'Unbounded', sans-serif", fontSize: 20, fontWeight: 800, color: '#f0f0f0',
  },
  authSub: { fontSize: 14, color: '#777', lineHeight: 1.7, maxWidth: 380 },
  btnRetry: {
    background: 'transparent', color: '#777',
    border: '1px solid #2a2a2a', borderRadius: 8,
    padding: '8px 18px', fontFamily: 'inherit', fontSize: 13,
    cursor: 'pointer',
  },
  mainWrap: { width: '100%', display: 'flex', flexDirection: 'column' },
  header: {
    borderBottom: '1px solid #2a2a2a', padding: '16px 40px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 60, background: 'rgba(13,13,13,0.95)',
    backdropFilter: 'blur(12px)', zIndex: 9,
  },
  logo: {
    fontFamily: "'Unbounded', sans-serif", fontSize: 13, fontWeight: 800,
    letterSpacing: '0.08em', color: '#f0f0f0',
  },
  btnLogout: {
    background: 'transparent', color: '#777', border: '1px solid #2a2a2a',
    borderRadius: 7, padding: '6px 14px', fontSize: 11,
    fontFamily: "'Unbounded', sans-serif", fontWeight: 600,
    letterSpacing: '0.06em', cursor: 'pointer',
  },
  main: { maxWidth: 760, margin: '0 auto', padding: '40px 24px 80px', width: '100%' },
  pageTitle: {
    fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
    color: '#777', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
  },
  groupName: {
    fontFamily: "'Unbounded', sans-serif", fontSize: 28, fontWeight: 800,
    lineHeight: 1.2, marginBottom: 32, color: '#f0f0f0',
  },
  groupInputRow: { display: 'flex', gap: 10, marginBottom: 32, flexWrap: 'wrap' },
  groupInput: {
    flex: 1, minWidth: 200, background: '#161616', color: '#f0f0f0',
    border: '1px solid #2a2a2a', borderRadius: 8,
    padding: '9px 14px', fontFamily: 'inherit', fontSize: 13, outline: 'none',
  },
  controls: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' },
  select: {
    background: '#161616', color: '#f0f0f0', border: '1px solid #2a2a2a',
    borderRadius: 8, padding: '9px 14px', fontFamily: 'inherit', fontSize: 13,
    cursor: 'pointer', outline: 'none',
  },
  btnLoad: {
    background: '#4f7fff', color: '#fff', border: 'none',
    borderRadius: 8, padding: '9px 22px',
    fontFamily: "'Unbounded', sans-serif", fontSize: 11, fontWeight: 600,
    letterSpacing: '0.06em', cursor: 'pointer',
  },
  autoRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#777', marginBottom: 28 },
  status: { fontSize: 13, color: '#777', marginBottom: 24, minHeight: 20, display: 'flex', alignItems: 'center', gap: 8 },
  spinner: {
    width: 14, height: 14, border: '2px solid #2a2a2a', borderTopColor: '#4f7fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0,
  },
  postCard: {
    background: '#1c1c1c', border: '1px solid #2a2a2a',
    borderRadius: 14, padding: 24,
  },
  postHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'rgba(79,127,255,0.12)', border: '1px solid rgba(79,127,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Unbounded', sans-serif", fontSize: 13, fontWeight: 800,
    color: '#4f7fff', flexShrink: 0, overflow: 'hidden',
  },
  authorName: {
    fontWeight: 500, fontSize: 14, color: '#f0f0f0',
    textDecoration: 'none', display: 'block',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  postDate: { fontSize: 12, color: '#777', marginTop: 2 },
  postIndex: {
    fontFamily: "'Unbounded', sans-serif", fontSize: 10,
    fontWeight: 600, color: '#777', letterSpacing: '0.06em',
  },
  postText: { fontSize: 14, lineHeight: 1.75, color: '#c8c8c8', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  postNoText: { fontSize: 13, color: '#777', fontStyle: 'italic' },
  errorMsg: {
    background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.2)',
    borderRadius: 10, padding: '14px 18px', fontSize: 13, color: '#e07070',
    lineHeight: 1.6, marginBottom: 16,
  },
  code: {
    fontFamily: 'monospace', fontSize: 12,
    background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4,
  },
  empty: { textAlign: 'center', padding: '60px 0', color: '#777', fontSize: 14 },
}
