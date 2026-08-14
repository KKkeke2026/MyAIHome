export default function Header({ title, action, icon, eyebrow }) {
  return (
    <header className="app-header" aria-label={title}>
      <div className="brand-wrap">
        <div className="brand-mark">{icon || 'AI'}</div>
        <div>
          {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
          <h1>{title}</h1>
        </div>
      </div>
      {action ? <div className="header-action-slot">{action}</div> : null}
    </header>
  )
}
