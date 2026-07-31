export function Input({
  label,
  className = '',
  type,
  value,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="space-y-1">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <input
        className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 ${className}`}
        type={type}
        value={
          type === 'number' && (value === 0 || value === '0')
            ? ''
            : value
        }
        {...props}
      />
    </label>
  )
}
