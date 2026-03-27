import { useState } from 'react'
import TelegramSender from './components/TelegramSender.jsx'
import VkFeed from './components/VkFeed.jsx'

const TABS = { TG: 'tg', VK: 'vk' }

export default function App() {
  const [tab, setTab] = useState(TABS.TG)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      <nav style={s.nav}>
        <span style={s.logo}>YTK<span style={{ color: 'var(--accent)' }}>A</span></span>
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === TABS.TG ? s.tabActive : {}) }}
            onClick={() => setTab(TABS.TG)}
          >
            Telegram
          </button>
          <button
            style={{ ...s.tab, ...(tab === TABS.VK ? s.tabActive : {}) }}
            onClick={() => setTab(TABS.VK)}
          >
            VK Feed
          </button>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === TABS.TG && <TelegramSender />}
        {tab === TABS.VK && <VkFeed />}
      </div>

    </div>
  )
}

const s = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 32,
    padding: '0 32px',
    height: 58,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(12px)',
  },
  logo: {
    fontFamily: "'Unbounded', sans-serif",
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: '0.1em',
    color: 'var(--text)',
  },
  tabs: {
    display: 'flex',
    gap: 4,
  },
  tab: {
    padding: '6px 20px',
    border: 'none',
    borderRadius: 8,
    background: 'transparent',
    color: 'var(--muted)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.02em',
  },
  tabActive: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
  },
}
