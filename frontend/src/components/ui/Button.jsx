export default function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  return (
    <button
      className={`ui-button ${variant} ${size} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}
