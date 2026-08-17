import { useState } from "react";
import Room from "../pages/Room";
import ChatWindow from "../components/ChatWindow";

const navItems = [
  { key: "room", label: "Room", icon: "⌂" },
  { key: "memory", label: "Memory", icon: "◌" },
  { key: "chat", label: "Chat", icon: "✦" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

function MyAIHomeShell() {
  const [activeTab, setActiveTab] = useState("room");

  return (
    <div className="myaihome-app">
      <div className="phone-frame">

        <header className="app-header">
          <div className="brand-wrap">
            <div className="brand-mark">AI</div>

            <div>
              <div className="eyebrow">
                MyAIHome
              </div>

              <h1>
                {activeTab === "room" && "Room"}
                {activeTab === "memory" && "Memory"}
                {activeTab === "chat" && "Chat"}
                {activeTab === "settings" && "Settings"}
              </h1>
            </div>
          </div>
        </header>

        <main className="screen-content">

          {activeTab === "room" && (
            <Room />
          )}

          {activeTab === "chat" && (
            <ChatWindow />
          )}

          {activeTab === "memory" && (
            <MemoryPage />
          )}

          {activeTab === "settings" && (
            <SettingsPage />
          )}

        </main>

        <nav className="bottom-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                activeTab === item.key
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => setActiveTab(item.key)}
            >
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </nav>

      </div>
    </div>
  );
}

function MemoryPage() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadMemory() {
    setLoading(true);

    try {
      const response = await fetch("/api/memory");

      if (!response.ok) {
        throw new Error("加载记忆失败");
      }

      const data = await response.json();

      setMemories(
        Array.isArray(data)
          ? data
          : data.memories || []
      );

    } catch (error) {
      console.error(error);
      setMemories([]);
    }

    setLoading(false);
  }

  return (
    <section className="screen memory-screen">

      <div className="section-card">
        <div className="section-head">
          <span>Memory</span>

          <button
            type="button"
            className="soft-button"
            onClick={loadMemory}
          >
            刷新
          </button>
        </div>
      </div>

      {loading && (
        <div className="memory-card">
          正在加载记忆...
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="memory-card">
          现在还没有长期记忆。
        </div>
      )}

      <div className="memory-stack">
        {memories.map((item, index) => (
          <div
            className="memory-card"
            key={item.id || index}
          >
            <strong>
              {item.category || "记忆"}
            </strong>

            <div>
              {item.content || item.text || String(item)}
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}

function SettingsPage() {
  return (
    <section className="screen settings-screen">

      <div className="section-card">
        <div className="section-head">
          <span>Settings</span>
        </div>
      </div>

      <div className="settings-stack">

        <div className="setting-row">
          <span>AI Provider</span>
          <strong>Claude</strong>
        </div>

        <div className="setting-row">
          <span>Memory</span>
          <strong>Local</strong>
        </div>

        <div className="setting-row">
          <span>Mode</span>
          <strong>Personal</strong>
        </div>

      </div>

    </section>
  );
}

export default MyAIHomeShell;
