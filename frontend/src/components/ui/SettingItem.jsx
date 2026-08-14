export default function SettingItem({ label, value, hint, action, className = '' }) {
  return (
    <div className={`setting-item ${className}`.trim()}>
      <div className="setting-copy">
        <span className="setting-label">{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="setting-meta">
        {value ? <strong>{value}</strong> : null}
        {action ? <span className="setting-action">{action}</span> : null}
      </div>
    </div>
  )
}
