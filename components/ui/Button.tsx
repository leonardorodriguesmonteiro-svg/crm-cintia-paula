export function Button({
  children,
  type = 'button',
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}) {
  const styles = {
    primary: 'bg-pink-600 text-white hover:bg-pink-700',
    secondary: 'border bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
  }

  return (
    <button
      type={type}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
