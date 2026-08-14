export default function BottomNav({ items, activeKey, onChange }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = activeKey === item.key

        return (
          <button
            key={item.key}
            type="button"
            className={isActive ? 'nav-button active' : 'nav-button'}
            onClick={() => onChange(item.key)}
          >
            <Icon size={18} strokeWidth={2.2} />
            <small>{item.label}</small>
          </button>
        )
      })}
    </nav>
  )
}
