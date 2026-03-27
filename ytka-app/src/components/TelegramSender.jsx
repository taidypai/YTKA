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
  SESSION: 'tg_session',
  API_ID: 'tg_api_id',
  API_HASH: 'tg_api_hash',
  PHONE: 'tg_phone',
  SELECTED: 'tg_selected_chats',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function TelegramSender() {
  const [step, setStep] = useState(STEPS.CREDENTIALS)
  const [form, setForm] = useState({
    apiId: localStorage.getItem(LS.API_ID) || import.meta.env.VITE_API_ID || '',
    apiHash: localStorage.getItem(LS.API_HASH) || import.meta.env.VITE_API_HASH || '',
    phone: localStorage.getItem(LS.PHONE) || '',
    code: '',
    password: '',
    message: '',
  })
  const [status, setStatus] = useState({ text: '', isError: false })
  const [loading, setLoading] = useState(false)
  const [dialogs, setDialogs] = useState([])
  const [selected, setSelected] = useState(() => {
    try {
      const saved = localStorage.getItem(LS.SELECTED)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch { return new Set() }
  })
  const [search, setSearch] = useState('')
  const [sendProgress, setSendProgress] = useState(null)

  const clientRef = useRef(null)
  const resolvers = useRef({})

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  useEffect(() => {
    localStorage.setItem(LS.SELECTED, JSON.stringify([...selected]))
  }, [selected])

  useEffect(() => {
    const savedSession = localStorage.getItem(LS.SESSION)
    const savedApiId = localStorage.getItem(LS.API_ID)
    const savedApiHash = localStorage.getItem(LS.API_HASH)
    if (savedSession && savedApiId && savedApiHash) {
      restoreSession(savedApiId, savedApiHash, savedSession)
    }
  }, [])

  const restoreSession = async (apiId, apiHash, sessionStr) => {
    setLoading(true)
    setStatus({ text: 'Восстанавливаем сессию…', isError: false })
    try {
      const client = new TelegramClient(
        new StringSession(sessionStr),
        parseInt(apiId, 10),
        apiHash.trim(),
        { connectionRetries: 5, useWSS: false }
      )
      await client.connect()
      const authorized = await client.isUserAuthorized()
      if (!authorized) {
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
        id: String(d.id),
        name: d.title || d.name || 'Без названия',
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
      setStatus({ text: 'Заполни все поля', isError: true })
      return
    }
    setLoading(true)
    setStatus({ text: '', isError: false })
    localStorage.setItem(LS.API_ID, form.apiId)
    localStorage.setItem(LS.API_HASH, form.apiHash)
    localStorage.setItem(LS.PHONE, form.phone)

    try {
      const client = new TelegramClient(
        new StringSession(''),
        parseInt(form.apiId, 10),
        form.apiHash.trim(),
        { connectionRetries: 5, useWSS: false }
      )
      clientRef.current = client

      client.start({
        phoneNumber: async () => form.phone.trim(),
        phoneCode: async () =>
          new Promise((resolve) => {
            resolvers.current.code = resolve
            setStep(STEPS.CODE)
            setLoading(false)
          }),
        password: async () =>
          new Promise((resolve) => {
            resolvers.current.password = resolve
            setStep(STEPS.PASSWORD)
            setLoading(false)
          }),
        onError: (err) => {
          setStatus({ text: 'Ошибка: ' + err.message, isError: true })
          setLoading(false)
        },
      })
      .then(async () => {
        const sessionStr = client.session.save()
        localStorage.setItem(LS.SESSION, sessionStr)
        await loadDialogs(client)
      })
      .catch((err) => {
        setStatus({ text: 'Ошибка подключения: ' + err.message, isError: true })
        setLoading(false)
      })
    } catch (err) {
      setStatus({ text: 'Ошибка: ' + err.message, isError: true })
      setLoading(false)
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

  const handleMessageNext = () => {
    if (!form.message.trim()) return
    setStep(STEPS.CHAT_SELECT)
    setStatus({ text: '', isError: false })
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
    setSendProgress({ current: 0, total: selected.size })
    const targets = dialogs.filter((d) => selected.has(d.id))
    const errors = []

    for (let i = 0; i < targets.length; i++) {
      const chat = targets[i]
      setSendProgress({ current: i + 1, total: targets.length })
      setStatus({ text: `Отправляем в "${chat.name}"…`, isError: false })
      try {
        await clientRef.current.sendMessage(chat.entity, { message: form.message.trim() })
      } catch {
        errors.push(chat.name)
      }
      if (i < targets.length - 1) await sleep(2000)
    }

    setLoading(false)
    setSendProgress(null)
    setStep(STEPS.DONE)
    if (errors.length > 0) {
      setStatus({ text: `Не удалось отправить в: ${errors.join(', ')}`, isError: true })
    } else {
      setStatus({ text: `✅ Отправлено в ${targets.length} чат(ов)!`, isError: false })
    }
  }

  const handleLogout = () => {
    clientRef.current?.disconnect?.()
    clientRef.current = null
    resolvers.current = {}
    localStorage.removeItem(LS.SESSION)
    setStep(STEPS.CREDENTIALS)
    setForm((prev) => ({ ...prev, code: '', password: '', message: '' }))
    setStatus({ text: '', isError: false })
    setLoading(false)
    setDialogs([])
    setSendProgress(null)
  }

  const handleSendAgain = () => {
    setStep(STEPS.MESSAGE)
    setSearch('')
    setForm((prev) => ({ ...prev, message: '' }))
    setStatus({ text: '', isError: false })
  }

  const filteredDialogs = dialogs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.cardHeader}>
          <h2 style={s.title}>Telegram Sender</h2>
          {step !== STEPS.CREDENTIALS && step !== STEPS.CODE && step !== STEPS.PASSWORD && (
            <button style={s.logoutBtn} onClick={handleLogout}>Выйти</button>
          )}
        </div>

        {step === STEPS.CREDENTIALS && (
          <div style={s.form}>
            <label style={s.label}>API ID</label>
            <input style={s.input} type="number" placeholder="123456" value={form.apiId} onChange={set('apiId')} />
            <label style={s.label}>API Hash</label>
            <input style={s.input} type="text" placeholder="abc123..." value={form.apiHash} onChange={set('apiHash')} />
            <label style={s.label}>Номер телефона</label>
            <input style={s.input} type="tel" placeholder="+79991234567" value={form.phone} onChange={set('phone')} />
            <p style={s.hint}>
              Получи API ID и Hash на{' '}
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer" style={s.link}>my.telegram.org</a>
            </p>
            <button style={s.button} onClick={handleConnect} disabled={loading}>
              {loading ? 'Подключаемся…' : 'Подключиться'}
            </button>
          </div>
        )}

        {step === STEPS.CODE && (
          <div style={s.form}>
            <p style={s.hint}>Код отправлен на <strong>{form.phone}</strong></p>
            <label style={s.label}>Код из SMS / приложения</label>
            <input style={s.input} type="text" placeholder="12345" value={form.code} onChange={set('code')}
              autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()} />
            <button style={s.button} onClick={handleCodeSubmit} disabled={loading}>
              {loading ? 'Проверяем…' : 'Подтвердить'}
            </button>
          </div>
        )}

        {step === STEPS.PASSWORD && (
          <div style={s.form}>
            <p style={s.hint}>Введи пароль 2FA</p>
            <label style={s.label}>Пароль</label>
            <input style={s.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')}
              autoFocus onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()} />
            <button style={s.button} onClick={handlePasswordSubmit} disabled={loading}>
              {loading ? 'Проверяем…' : 'Войти'}
            </button>
          </div>
        )}

        {step === STEPS.MESSAGE && (
          <div style={s.form}>
            <label style={s.label}>Сообщение</label>
            <textarea style={{ ...s.input, height: 140, resize: 'vertical' }}
              placeholder="Введи текст сообщения…" value={form.message} onChange={set('message')} autoFocus />
            {selected.size > 0 && (
              <p style={s.hint}>Выбрано чатов: <strong>{selected.size}</strong></p>
            )}
            <button style={s.button} onClick={handleMessageNext} disabled={!form.message.trim()}>
              Выбрать чаты →
            </button>
          </div>
        )}

        {step === STEPS.CHAT_SELECT && (
          <div style={s.form}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={s.backBtn} onClick={() => setStep(STEPS.MESSAGE)}>←</button>
              <p style={{ ...s.hint, margin: 0, flex: 1 }}>Выбрано: <strong>{selected.size}</strong></p>
              <button
                style={{ ...s.button, marginTop: 0, padding: '0.4rem 0.8rem', fontSize: 13 }}
                onClick={handleSend}
                disabled={selected.size === 0 || loading}
              >
                {loading
                  ? sendProgress ? `${sendProgress.current}/${sendProgress.total}` : '…'
                  : '📤 Отправить'}
              </button>
            </div>
            <input style={s.input} type="text" placeholder="Поиск по чатам…"
              value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            <div style={s.chatList}>
              {filteredDialogs.map((chat) => (
                <label key={chat.id} style={{ ...s.chatItem, background: selected.has(chat.id) ? '#ebf4ff' : 'transparent' }}>
                  <input type="checkbox" checked={selected.has(chat.id)} onChange={() => toggleChat(chat.id)}
                    style={{ marginRight: 10, width: 16, height: 16, cursor: 'pointer' }} />
                  {chat.name}
                </label>
              ))}
              {filteredDialogs.length === 0 && (
                <p style={{ ...s.hint, textAlign: 'center', padding: '1rem' }}>Ничего не найдено</p>
              )}
            </div>
          </div>
        )}

        {step === STEPS.DONE && (
          <div style={s.form}>
            <p style={{ textAlign: 'center', fontSize: 48 }}>🎉</p>
            <button style={s.button} onClick={handleSendAgain}>Отправить ещё</button>
          </div>
        )}

        {status.text && (
          <p style={{ ...s.status, color: status.isError ? '#e53e3e' : '#38a169' }}>{status.text}</p>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: { width: '100%', display: 'flex', justifyContent: 'center' },
  card: {
    background: '#fff', borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
    padding: '2rem', width: '100%', maxWidth: 420,
  },
  cardHeader: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: '1.5rem',
  },
  title: { fontSize: 20, fontWeight: 700, color: '#2d3748', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  label: { fontSize: 13, fontWeight: 600, color: '#4a5568' },
  input: {
    padding: '0.65rem 0.85rem', border: '1.5px solid #cbd5e0',
    borderRadius: 8, fontSize: 15, outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  },
  button: {
    marginTop: '0.5rem', padding: '0.75rem',
    background: '#3182ce', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer',
  },
  chatList: {
    display: 'flex', flexDirection: 'column', gap: 2,
    maxHeight: 300, overflowY: 'auto',
    border: '1.5px solid #cbd5e0', borderRadius: 8, padding: '0.25rem',
  },
  chatItem: {
    display: 'flex', alignItems: 'center',
    padding: '0.55rem 0.85rem', borderRadius: 6,
    fontSize: 14, color: '#2d3748', cursor: 'pointer', userSelect: 'none',
  },
  backBtn: {
    padding: '0.4rem 0.7rem', fontSize: 16, background: 'none',
    border: '1.5px solid #cbd5e0', borderRadius: 8, cursor: 'pointer', color: '#4a5568',
  },
  logoutBtn: {
    padding: '0.3rem 0.7rem', fontSize: 12, background: 'none',
    border: '1px solid #cbd5e0', borderRadius: 6, cursor: 'pointer', color: '#718096',
  },
  hint: { fontSize: 13, color: '#718096', margin: '0.25rem 0' },
  link: { color: '#3182ce' },
  status: { marginTop: '1rem', fontSize: 14, textAlign: 'center', fontWeight: 500 },
}
