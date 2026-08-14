export default function SectionTitle({ title, action, className = '' }) {
  return (
    <div className={`section-title ${className}`.trim()}>
      <span>{title}</span>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  )
}
