export default function Modal({ open, title, children, onClose }) {
  if (!open) return null

  return (
    <div className="ui-modal-backdrop" onClick={onClose}>
      <div className="ui-modal" onClick={(event) => event.stopPropagation()}>
        {title ? <div className="ui-modal-title">{title}</div> : null}
        {children}
      </div>
    </div>
  )
}
