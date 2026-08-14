export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${className}`} {...props}>
      {children}
    </div>
  )
}
