import { useState } from 'react'
import TelegramSender from './components/TelegramSender'
import VkFeed from './components/VkFeed'

const TABS = {
  TG: 'tg',
  VK: 'vk',
}

export default function App() {
  const [tab, setTab] = useState(TABS.TG)

  return (
    <div style={styles.root}>
      {/* ── Навигация ── */}
      <nav style={styles.nav}>
        <span style={styles.navLogo}>YTKA</span>
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === TABS.TG ? styles.tabActive : {}) }}
            onClick={() => setTab(TABS.TG)}
          >
            📨 Telegram
          </button>
          <button
            style={{ ...styles.tab, ...(tab === TABS.VK ? styles.tabActive : {}) }}
            onClick={() => setTab(TABS.VK)}
          >
            🔵 VK Feed
          </button>
        </div>
      </nav>

      {/* ── Контент ── */}
      <div style={{
        ...styles.content,
        background: tab === TABS.VK ? '#0d0d0d' : 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
      }}>
        {tab === TABS.TG && (
          <div style={styles.tgWrap}>
            <TelegramSender />
          </div>
        )}
        {tab === TABS.VK && <VkFeed />}
      </div>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    fontFamily: "'Segoe UI', 'Inter', sans-serif",
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '0 32px',
    height: 60,
    background: '#111',
    borderBottom: '1px solid #222',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navLogo: {
    fontFamily: "'Unbounded', sans-serif",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: '0.12em',
    color: '#fff',
  },
  tabs: {
    display: 'flex',
    gap: 4,
  },
  tab: {
    padding: '6px 18px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: '#888',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#222',
    color: '#fff',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    transition: 'background 0.3s',
  },
  tgWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
  },
}
