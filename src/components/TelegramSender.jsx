import { useState, useRef, useEffect } from 'react'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

const STEPS = {
  CREDENTIALS: 'credentials',
  CODE: 'code',
  PASSWORD: 'password',
  MESSAGE: 'message',
  CHAT_SELECT: 'chat_select',
  DONE: 'done',
}

const LS = {
  SESSION:  'tg_session',
  API_ID:   'tg_api_id',
  API_HASH: 'tg_api_hash',
  PHONE:    'tg_phone',
  SELECTED: 'tg_selected_chats',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function TelegramSender() {
  const [step, setStep] = useState(STEPS.CREDENTIALS)
  const [form, setForm] = useState({
    apiId:    localStorage.getItem(LS.API_ID)   || import.meta.env.VITE_API_ID   || '',
    apiHash:  localStorage.getItem(LS.API_HASH) || import.meta.env.VITE_API_HASH || '',
    phone:    localStorage.getItem(LS.PHONE)    || '',
    code:     '',
    password: '',
    message:  '',
  })
  const [status, setStatus]         = useState({ text: '', isError: false })
  const [loading, setLoading]       = useState(false)
  const [dialogs, setDialogs]       = useState([])
  const [selected, setSelected]     = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS.SELECTED) || '[]')) }
    catch { return new Set() }
  })
  const [search, setSearch]         = useState('')
  const [sendProgress, setSendProgress] = useState(null)

  const clientRef  = useRef(null)
  const resolvers  = useRef({})

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))

  useEffect(() => {
    localStorage.setItem(LS.SELECTED, JSON.stringify([...selected]))
  }, [selected])

  useEffect(() => {
    const sess    = localStorage.getItem(LS.SESSION)
    const apiId   = localStorage.getItem(LS.API_ID)
    const apiHash = localStorage.getItem(LS.API_HASH)
    if (sess && apiId && apiHash) restoreSession(apiId, apiHash, sess)
  }, [])

  const restoreSession = async (apiId, apiHash, sessionStr) => {
    setLoading(true)
    setStatus({ text: 'Восстанавливаем сессию…', isError: false })
    try {
      const client = new TelegramClient(
        new StringSession(sessionStr), parseInt(apiId, 10), apiHash.trim(),
        { connectionRetries: 5, useWSS: false }
      )
      await client.connect()
      if (!(await client.isUserAuthorized())) {
        localStorage.removeItem(LS.SESSION)
        setStatus({ text: '', isError: false })
        setLoading(false)
        return
      }
      clientRef.current = client
      await loadDialogs(client)
    } catch {
      localStorage.removeItem(LS.SESSION)
      setStatus({ text: '', isError: false })
      setLoading(false)
    }
  }

  const loadDialogs = async (client) => {
    setStatus({ text: 'Загружаем чаты…', isError: false })
    setLoading(true)
    try {
      const result = await client.getDialogs({ limit: 200 })
      const chats = result.map((d) => ({
        id:     String(d.id),
        name:   d.title || d.name || 'Без названия',
        entity: d.entity,
      }))
      chats.unshift({ id: 'me', name: '⭐ Избранное', entity: 'me' })
      setDialogs(chats)
      setStep(STEPS.MESSAGE)
      setStatus({ text: '', isError: false })
    } catch (err) {
      setStatus({ text: 'Ошибка загрузки чатов: ' + err.message, isError: true })
    }
    setLoading(false)
  }

  const handleConnect = async () => {
    if (!form.apiId || !form.apiHash || !form.phone) {
      setStatus({ text: 'Заполни все поля', isError: true }); return
    }
    setLoading(true)
    setStatus({ text: '', isError: false })
    localStorage.setItem(LS.API_ID,   form.apiId)
    localStorage.setItem(LS.API_HASH, form.apiHash)
    localStorage.setItem(LS.PHONE,    form.phone)

    try {
      const client = new TelegramClient(
        new StringSession(''), parseInt(form.apiId, 10), form.apiHash.trim(),
        { connectionRetries: 5, useWSS: false }
      )
      clientRef.current = client

      client.start({
        phoneNumber: async () => form.phone.trim(),
        phoneCode: async () => new Promise((resolve) => {
          resolvers.current.code = resolve
          setStep(STEPS.CODE); setLoading(false)
        }),
        password: async () => new Promise((resolve) => {
          resolvers.current.password = resolve
          setStep(STEPS.PASSWORD); setLoading(false)
        }),
        onError: (err) => {
          setStatus({ text: 'Ошибка: ' + err.message, isError: true }); setLoading(false)
        },
      })
      .then(async () => {
        localStorage.setItem(LS.SESSION, client.session.save())
        await loadDialogs(client)
      })
      .catch((err) => {
        setStatus({ text: 'Ошибка подключения: ' + err.message, isError: true }); setLoading(false)
      })
    } catch (err) {
      setStatus({ text: 'Ошибка: ' + err.message, isError: true }); setLoading(false)
    }
  }

  const handleCodeSubmit = () => {
    if (!form.code.trim()) return
    setLoading(true)
    setStatus({ text: 'Проверяем код…', isError: false })
    resolvers.current.code?.(form.code.trim())
    resolvers.current.code = null
  }

  const handlePasswordSubmit = () => {
    if (!form.password.trim()) return
    setLoading(true)
    setStatus({ text: 'Проверяем пароль…', isError: false })
    resolvers.current.password?.(form.password.trim())
    resolvers.current.password = null
  }

  const toggleChat = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (selected.size === 0) return
    setLoading(true)
    const targets = dialogs.filter((d) => selected.has(d.id))
    const errors  = []

    for (let i = 0; i < targets.length; i++) {
      const chat = targets[i]
      setSendProgress({ current: i + 1, total: targets.length })
      setStatus({ text: `Отправляем в "${chat.name}"…`, isError: false })
      try {
        await clientRef.current.sendMessage(chat.entity, { message: form.message.trim() })
      } catch { errors.push(chat.name) }
      if (i < targets.length - 1) await sleep(2000)
    }

    setLoading(false); setSendProgress(null); setStep(STEPS.DONE)
    setStatus(errors.length > 0
      ? { text: `Не удалось: ${errors.join(', ')}`, isError: true }
      : { text: `✅ Отправлено в ${targets.length} чат(ов)`, isError: false }
    )
  }

  const handleLogout = () => {
    clientRef.current?.disconnect?.()
    clientRef.current = null; resolvers.current = {}
    localStorage.removeItem(LS.SESSION)
    setStep(STEPS.CREDENTIALS)
    setForm((p) => ({ ...p, code: '', password: '', message: '' }))
    setStatus({ text: '', isError: false }); setLoading(false)
    setDialogs([]); setSendProgress(null)
  }

  const handleSendAgain = () => {
    setStep(STEPS.MESSAGE); setSearch('')
    setForm((p) => ({ ...p, message: '' }))
    setStatus({ text: '', isError: false })
  }

  const filtered = dialogs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const isAuth = step !== STEPS.CREDENTIALS && step !== STEPS.CODE && step !== STEPS.PASSWORD

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Заголовок карточки */}
        <div style={s.cardTop}>
          <div>
            <p style={s.cardLabel}>СЕРВИС</p>
            <h2 style={s.cardTitle}>Telegram Рассылка</h2>
          </div>
          {isAuth && (
            <button style={s.btnGhost} onClick={handleLogout}>Выйти</button>
          )}
        </div>

        {/* ── Шаг 1: данные ── */}
        {step === STEPS.CREDENTIALS && (
          <div style={s.form}>
            <Field label="API ID">
              <input style={s.input} type="number" placeholder="123456"
                value={form.apiId} onChange={set('apiId')} />
            </Field>
            <Field label="API Hash">
              <input style={s.input} type="text" placeholder="abc123..."
                value={form.apiHash} onChange={set('apiHash')} />
            </Field>
            <Field label="Номер телефона">
              <input style={s.input} type="tel" placeholder="+79991234567"
                value={form.phone} onChange={set('phone')}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()} />
            </Field>
            <p style={s.hint}>
              API ID и Hash — на{' '}
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a>
            </p>
            <button style={s.btn} onClick={handleConnect} disabled={loading}>
              {loading ? <Spinner /> : 'Подключиться'}
            </button>
          </div>
        )}

        {/* ── Шаг 2: код ── */}
        {step === STEPS.CODE && (
          <div style={s.form}>
            <p style={s.hint}>Код отправлен на <strong style={{ color: 'var(--text)' }}>{form.phone}</strong></p>
            <Field label="Код из SMS / приложения">
              <input style={s.input} type="text" placeholder="12345"
                value={form.code} onChange={set('code')} autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()} />
            </Field>
            <button style={s.btn} onClick={handleCodeSubmit} disabled={loading}>
              {loading ? <Spinner /> : 'Подтвердить'}
            </button>
          </div>
        )}

        {/* ── Шаг 3: 2FA ── */}
        {step === STEPS.PASSWORD && (
          <div style={s.form}>
            <p style={s.hint}>Двухфакторная аутентификация</p>
            <Field label="Пароль 2FA">
              <input style={s.input} type="password" placeholder="••••••••"
                value={form.password} onChange={set('password')} autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} />
            </Field>
            <button style={s.btn} onClick={handlePasswordSubmit} disabled={loading}>
              {loading ? <Spinner /> : 'Войти'}
            </button>
          </div>
        )}

        {/* ── Шаг 4: сообщение ── */}
        {step === STEPS.MESSAGE && (
          <div style={s.form}>
            <Field label="Текст сообщения">
              <textarea style={{ ...s.input, height: 140, resize: 'vertical' }}
                placeholder="Введи текст…" value={form.message}
                onChange={set('message')} autoFocus />
            </Field>
            {selected.size > 0 && (
              <p style={s.hint}>Выбрано чатов: <strong style={{ color: 'var(--accent)' }}>{selected.size}</strong></p>
            )}
            <button style={s.btn} onClick={() => { if (form.message.trim()) setStep(STEPS.CHAT_SELECT) }}
              disabled={!form.message.trim()}>
              Выбрать чаты →
            </button>
          </div>
        )}

        {/* ── Шаг 5: выбор чатов ── */}
        {step === STEPS.CHAT_SELECT && (
          <div style={s.form}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={s.btnIcon} onClick={() => setStep(STEPS.MESSAGE)}>←</button>
              <span style={{ ...s.hint, flex: 1 }}>
                Выбрано: <strong style={{ color: 'var(--accent)' }}>{selected.size}</strong>
              </span>
              <button style={{ ...s.btn, marginTop: 0, padding: '8px 20px', fontSize: 13 }}
                onClick={handleSend} disabled={selected.size === 0 || loading}>
                {loading
                  ? sendProgress ? `${sendProgress.current} / ${sendProgress.total}` : <Spinner />
                  : '📤 Отправить'}
              </button>
            </div>

            <input style={s.input} type="text" placeholder="Поиск по чатам…"
              value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />

            <div style={s.chatList}>
              {filtered.map((chat) => (
                <label key={chat.id} style={{
                  ...s.chatItem,
                  background: selected.has(chat.id) ? 'var(--accent-dim)' : 'transparent',
                  borderColor: selected.has(chat.id) ? 'rgba(79,127,255,0.2)' : 'transparent',
                }}>
                  <input type="checkbox" checked={selected.has(chat.id)}
                    onChange={() => toggleChat(chat.id)}
                    style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)', marginRight: 10 }} />
                  {chat.name}
                </label>
              ))}
              {filtered.length === 0 && (
                <p style={{ ...s.hint, textAlign: 'center', padding: '20px' }}>Ничего не найдено</p>
              )}
            </div>
          </div>
        )}

        {/* ── Шаг 6: готово ── */}
        {step === STEPS.DONE && (
          <div style={{ ...s.form, alignItems: 'center', paddingTop: 16 }}>
            <div style={s.doneIcon}>🎉</div>
            <button style={s.btn} onClick={handleSendAgain}>Отправить ещё</button>
          </div>
        )}

        {/* Статус */}
        {status.text && (
          <div style={{
            ...s.statusBox,
            borderColor: status.isError ? 'rgba(224,80,80,0.25)' : 'rgba(62,207,94,0.2)',
            background: status.isError ? 'rgba(224,80,80,0.07)' : 'rgba(62,207,94,0.07)',
            color: status.isError ? '#e07070' : '#3ecf5e',
          }}>
            {status.text}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  )
}

const s = {
  page: {
    flex: 1, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 20px',
    minHeight: 'calc(100vh - 58px)',
  },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '32px',
    width: '100%',
    maxWidth: 440,
    animation: 'fadeUp 0.3s ease',
  },
  cardTop: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 28,
  },
  cardLabel: {
    fontFamily: "'Unbounded', sans-serif",
    fontSize: 10, fontWeight: 600, color: 'var(--muted)',
    letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6,
  },
  cardTitle: {
    fontFamily: "'Unbounded', sans-serif",
    fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  input: {
    width: '100%', background: 'var(--surface)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 8,
    padding: '10px 14px', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s',
  },
  btn: {
    marginTop: 4, padding: '12px',
    background: 'var(--accent)', color: '#fff',
    border: 'none', borderRadius: 8,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'opacity 0.2s',
  },
  btnGhost: {
    padding: '6px 14px', background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 7,
    color: 'var(--muted)', fontSize: 12, cursor: 'pointer',
  },
  btnIcon: {
    padding: '8px 12px', background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--muted)', fontSize: 15, cursor: 'pointer',
  },
  chatList: {
    display: 'flex', flexDirection: 'column', gap: 2,
    maxHeight: 320, overflowY: 'auto',
    border: '1px solid var(--border)', borderRadius: 8, padding: 4,
  },
  chatItem: {
    display: 'flex', alignItems: 'center',
    padding: '9px 12px', borderRadius: 6,
    fontSize: 13, color: 'var(--text)', cursor: 'pointer',
    userSelect: 'none', border: '1px solid transparent',
    transition: 'all 0.1s',
  },
  hint: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 },
  statusBox: {
    marginTop: 20, padding: '12px 16px',
    border: '1px solid', borderRadius: 8,
    fontSize: 13, lineHeight: 1.5,
  },
  doneIcon: { fontSize: 52, marginBottom: 8 },
}
