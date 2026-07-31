export function Input({
  label,
  className = '',
  type,
  onFocus,
  onClick,
  onMouseUp,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="space-y-1">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <input
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 ${className}`}
        type={type}
        onFocus={evento => {
          if (type === 'number' && evento.currentTarget.value === '0') {
            evento.currentTarget.select()
          }

          onFocus?.(evento)
        }}
        onClick={evento => {
          if (type === 'number' && evento.currentTarget.value === '0') {
            evento.currentTarget.select()
          }

          onClick?.(evento)
        }}
        onMouseUp={evento => {
          if (type === 'number' && evento.currentTarget.value === '0') {
            evento.preventDefault()
            evento.currentTarget.select()
          }

          onMouseUp?.(evento)
        }}
        {...props}
      />
    </label>
  )
}
