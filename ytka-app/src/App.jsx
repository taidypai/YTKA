import { useState, useRef } from 'react'
import { TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'

const STEPS = {
  CREDENTIALS: 'credentials',
  CODE: 'code',
  PASSWORD: 'password',
  MESSAGE: 'message',
  DONE: 'done',
}

export default function App() {
  const [step, setStep] = useState(STEPS.CREDENTIALS)
  const [form, setForm] = useState({
    apiId: import.meta.env.VITE_API_ID || '',
    apiHash: import.meta.env.VITE_API_HASH || '',
    phone: '',
    code: '',
    password: '',
    message: '',
  })
  const [status, setStatus] = useState({ text: '', isError: false })
  const [loading, setLoading] = useState(false)

  const clientRef = useRef(null)
  const resolvers = useRef({})

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  // ─── Step 1: connect & start auth ────────────────────────────────────────
  const handleConnect = async () => {
    if (!form.apiId || !form.apiHash || !form.phone) {
      setStatus({ text: 'Заполни все поля', isError: true })
      return
    }
    setLoading(true)
    setStatus({ text: '', isError: false })

    try {
      const client = new TelegramClient(
        new StringSession(''),
        parseInt(form.apiId, 10),
        form.apiHash.trim(),
        {
          connectionRetries: 5,
          useWSS: false,
        }
      )
      clientRef.current = client

      // client.start() is async and will call these callbacks when needed
      client
        .start({
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
        .then(() => {
          setStep(STEPS.MESSAGE)
          setStatus({ text: '✅ Подключено! Введи сообщение.', isError: false })
          setLoading(false)
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

  // ─── Step 2: submit SMS code ──────────────────────────────────────────────
  const handleCodeSubmit = () => {
    if (!form.code.trim()) return
    setLoading(true)
    setStatus({ text: 'Проверяем код…', isError: false })
    resolvers.current.code?.(form.code.trim())
    resolvers.current.code = null
  }

  // ─── Step 3: submit 2FA password ─────────────────────────────────────────
  const handlePasswordSubmit = () => {
    if (!form.password.trim()) return
    setLoading(true)
    setStatus({ text: 'Проверяем пароль…', isError: false })
    resolvers.current.password?.(form.password.trim())
    resolvers.current.password = null
  }

  // ─── Step 4: send message ─────────────────────────────────────────────────
  const handleSend = async () => {
    if (!form.message.trim()) return
    setLoading(true)
    setStatus({ text: '', isError: false })
    try {
      await clientRef.current.sendMessage('me', { message: form.message.trim() })
      setStep(STEPS.DONE)
      setStatus({ text: '✅ Сообщение отправлено в Избранное!', isError: false })
    } catch (err) {
      setStatus({ text: 'Ошибка отправки: ' + err.message, isError: true })
    }
    setLoading(false)
  }

  const handleReset = () => {
    clientRef.current?.disconnect?.()
    clientRef.current = null
    resolvers.current = {}
    setStep(STEPS.CREDENTIALS)
    setForm({ apiId: '', apiHash: '', phone: '', code: '', password: '', message: '' })
    setStatus({ text: '', isError: false })
    setLoading(false)
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.title}>📨 Telegram → Избранное</h2>

        {/* STEP 1 — credentials */}
        {step === STEPS.CREDENTIALS && (
          <div style={styles.form}>
            <label style={styles.label}>API ID</label>
            <input
              style={styles.input}
              type="number"
              placeholder="123456"
              value={form.apiId}
              onChange={set('apiId')}
            />

            <label style={styles.label}>API Hash</label>
            <input
              style={styles.input}
              type="text"
              placeholder="abc123..."
              value={form.apiHash}
              onChange={set('apiHash')}
            />

            <label style={styles.label}>Номер телефона</label>
            <input
              style={styles.input}
              type="tel"
              placeholder="+79991234567"
              value={form.phone}
              onChange={set('phone')}
            />

            <p style={styles.hint}>
              Получи API ID и Hash на{' '}
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer" style={styles.link}>
                my.telegram.org
              </a>
            </p>

            <button style={styles.button} onClick={handleConnect} disabled={loading}>
              {loading ? 'Подключаемся…' : 'Подключиться'}
            </button>
          </div>
        )}

        {/* STEP 2 — SMS code */}
        {step === STEPS.CODE && (
          <div style={styles.form}>
            <p style={styles.hint}>
              Telegram отправил код на номер <strong>{form.phone}</strong>
            </p>
            <label style={styles.label}>Код из SMS / приложения</label>
            <input
              style={styles.input}
              type="text"
              placeholder="12345"
              value={form.code}
              onChange={set('code')}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
            />
            <button style={styles.button} onClick={handleCodeSubmit} disabled={loading}>
              {loading ? 'Проверяем…' : 'Подтвердить'}
            </button>
          </div>
        )}

        {/* STEP 3 — 2FA password */}
        {step === STEPS.PASSWORD && (
          <div style={styles.form}>
            <p style={styles.hint}>Введи пароль двухфакторной аутентификации</p>
            <label style={styles.label}>Пароль 2FA</label>
            <input
              style={styles.input}
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <button style={styles.button} onClick={handlePasswordSubmit} disabled={loading}>
              {loading ? 'Проверяем…' : 'Войти'}
            </button>
          </div>
        )}

        {/* STEP 4 — send message */}
        {step === STEPS.MESSAGE && (
          <div style={styles.form}>
            <label style={styles.label}>Сообщение</label>
            <textarea
              style={{ ...styles.input, height: 120, resize: 'vertical' }}
              placeholder="Привет, Избранное!"
              value={form.message}
              onChange={set('message')}
              autoFocus
            />
            <button style={styles.button} onClick={handleSend} disabled={loading || !form.message.trim()}>
              {loading ? 'Отправляем…' : '📤 Отправить в Избранное'}
            </button>
          </div>
        )}

        {/* STEP 5 — done */}
        {step === STEPS.DONE && (
          <div style={styles.form}>
            <p style={{ textAlign: 'center', fontSize: 48 }}>🎉</p>
            <button style={{ ...styles.button, background: '#6c757d' }} onClick={handleReset}>
              Отправить ещё
            </button>
          </div>
        )}

        {/* Status message */}
        {status.text && (
          <p style={{ ...styles.status, color: status.isError ? '#e53e3e' : '#38a169' }}>
            {status.text}
          </p>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
    fontFamily: "'Segoe UI', sans-serif",
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    padding: '2rem',
    width: '100%',
    maxWidth: 420,
  },
  title: {
    margin: '0 0 1.5rem',
    textAlign: 'center',
    fontSize: 22,
    color: '#2d3748',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#4a5568',
  },
  input: {
    padding: '0.65rem 0.85rem',
    border: '1.5px solid #cbd5e0',
    borderRadius: 8,
    fontSize: 15,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    background: '#3182ce',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  hint: {
    fontSize: 13,
    color: '#718096',
    margin: '0.25rem 0',
  },
  link: {
    color: '#3182ce',
  },
  status: {
    marginTop: '1rem',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: 500,
  },
}