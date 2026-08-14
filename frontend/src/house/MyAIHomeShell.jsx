import { useMemo, useState } from 'react'
import Room from '../pages/Room'
const navItems = [
  { key: 'room', label: 'Room', icon: '⌂' },
  { key: 'memory', label: 'Memory', icon: '◌' },
  { key: 'chat', label: 'Chat', icon: '✦' },
  { key: 'play', label: 'Play', icon: '▣' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
]

const roomEvents = [
  { title: '生日', date: '7 月 15 日', note: '纪念日', type: 'date' },
  { title: '结婚纪念日', date: '8 月 3 日', note: '一起的日子', type: 'date' },
  { title: '旅行计划', date: '8 月 18 日', note: '海边度假', type: 'trip' },
]

const memoryCards = [
  '喜欢安静、温暖的晚间氛围。',
  '更偏好温柔提醒和轻松节奏。',
  '喜欢小而可爱的日常仪式感。',
]

const playTiles = [
  { icon: '✦', title: 'Daily vibe', tone: 'warm' },
  { icon: '◌', title: 'Focus', tone: 'peach' },
  { icon: '☾', title: 'Sleep', tone: 'mint' },
  { icon: '▣', title: 'Mini fun', tone: 'lavender' },
]

const settingsRows = [
  { label: 'AI Provider', value: 'Claude' },
  { label: 'Theme', value: 'Soft Pastel' },
  { label: 'Voice', value: 'Default' },
]

function MyAIHomeShell() {
  const [activeTab, setActiveTab] = useState('room')
  const [showWelcome, setShowWelcome] = useState(true)

  const headerTitle = useMemo(() => {
    const map = {
      room: 'Room',
      memory: 'Memory',
      chat: 'Chat',
      play: 'Play',
      settings: 'Settings',
    }

    return map[activeTab] || 'Room'
  }, [activeTab])

  return (
    <div className="myaihome-app">
      <div className="phone-frame">
        {showWelcome && (
          <div className="welcome-overlay">
            <div className="welcome-card">
              <div className="welcome-badge">AI</div>
              <div className="welcome-title">Welcome to MyAIHome</div>
              <div className="welcome-subtitle">一个轻柔、温暖的陪伴空间。</div>
              <button type="button" className="welcome-button" onClick={() => setShowWelcome(false)}>
                进入主界面
              </button>
            </div>
          </div>
        )}

        <header className="app-header" aria-label={headerTitle}>
          <div className="brand-wrap">
            <div className="brand-mark">AI</div>
            <div>
              <div className="eyebrow">MyAIHome</div>
              <h1>{headerTitle}</h1>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="Search">
            ⌕
          </button>
        </header>

        <main className="screen-content">
          {activeTab === 'room' && (
  <Room />
)}

          {activeTab === 'memory' && (
            <section className="screen memory-screen">
              <div className="section-card memory-header-card">
                <div className="section-head">
                  <span>Memory</span>
                  <button type="button" className="soft-button">Open</button>
                </div>
              </div>

              <div className="memory-stack">
                {memoryCards.map((card, index) => (
                  <div className="memory-card" key={index}>{card}</div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'chat' && (
            <section className="screen chat-screen">
              <div className="chat-header-row">
                <div className="chat-persona">
                  <span className="persona-avatar">🤖</span>
                  <div>
                    <strong>Claire</strong>
                    <small>在线</small>
                  </div>
                </div>
                <button type="button" className="icon-button">⚙</button>
              </div>

              <div className="bubble-stack">
                <div className="bubble ai">晚安，想和我一起慢慢聊聊今天吗？</div>
                <div className="bubble user">想，我想让它温柔一点。</div>
                <div className="bubble ai">好的，我会陪着你，轻轻地一起走过。</div>
              </div>

              <div className="composer">
                <button type="button" className="circle-button">＋</button>
                <div className="composer-input">输入消息...</div>
                <button type="button" className="send-button">➤</button>
              </div>
            </section>
          )}

          {activeTab === 'play' && (
            <section className="screen play-screen">
              <div className="section-card memory-header-card">
                <div className="section-head">
                  <span>Play</span>
                  <button type="button" className="soft-button">Spark</button>
                </div>
              </div>

              <div className="play-grid">
                {playTiles.map((tile) => (
                  <div className={`play-tile ${tile.tone}`} key={tile.title}>
                    <span>{tile.icon}</span>
                    <strong>{tile.title}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'settings' && (
            <section className="screen settings-screen">
              <div className="section-card memory-header-card">
                <div className="section-head">
                  <span>Settings</span>
                </div>
              </div>

              <div className="settings-stack">
                {settingsRows.map((item) => (
                  <div className="setting-row" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <nav className="bottom-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={activeTab === item.key ? 'nav-button active' : 'nav-button'}
              onClick={() => setActiveTab(item.key)}
            >
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default MyAIHomeShell
