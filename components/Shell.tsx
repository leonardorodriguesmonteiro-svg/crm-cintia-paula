'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Users, Package, Boxes, CalendarDays, FileText, Wallet, Settings, LogOut } from 'lucide-react'

const items = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Kits', href: '/kits', icon: Package },
  { label: 'Estoque', href: '/estoque', icon: Boxes },
  { label: 'Reservas', href: '/reservas', icon: CalendarDays },
  { label: 'Contratos', href: '/contratos', icon: FileText },
  { label: 'Financeiro', href: '/financeiro', icon: Wallet },
  { label: 'Config.', href: '/configuracoes', icon: Settings },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex w-72 flex-col border-r bg-white p-6">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-pink-700">Cintia Paula</h1>
          <p className="text-sm text-slate-500">Festas e Decorações</p>
        </div>
        <nav className="flex-1 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href
            const Icon = item.icon
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-pink-50 text-pink-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Icon size={18} /> {item.label}
              </Link>
            )
          })}
        </nav>
        <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><LogOut size={18}/> Sair</button>
      </aside>
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 gap-1 border-t bg-white px-2 py-2 md:hidden">
        {items.slice(0,8).map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] ${active ? 'bg-pink-50 text-pink-700' : 'text-slate-500'}`}><Icon size={18}/>{item.label}</Link>
        })}
      </nav>
    </div>
  )
}
