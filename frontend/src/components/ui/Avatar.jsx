export default function Avatar({ icon: Icon, size = 'md', className = '', label = '' }) {
  const sizeMap = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
  }

  return (
    <div className={`ui-avatar ${sizeMap[size] || sizeMap.md} ${className}`.trim()} aria-label={label || 'avatar'}>
      {Icon ? <Icon size={size === 'lg' ? 24 : size === 'sm' ? 14 : 18} strokeWidth={2.1} /> : null}
    </div>
  )
}
