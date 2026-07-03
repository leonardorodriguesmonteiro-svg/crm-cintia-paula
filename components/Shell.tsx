'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  CalendarDays,
  FileText,
  Wallet,
  Settings,
  LogOut,
  Layers3
} from 'lucide-react'

const grupos = [
  {
    titulo: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }
    ]
  },
  {
    titulo: 'Cadastros',
    items: [
      { label: 'Clientes', href: '/clientes', icon: Users },
      { label: 'Kits', href: '/kits', icon: Package },
      { label: 'Estoque', href: '/estoque', icon: Boxes },
      { label: 'Composição', href: '/kits/composicao', icon: Layers3 }
    ]
  },
  {
    titulo: 'Operação',
    items: [
      { label: 'Reservas', href: '/reservas', icon: CalendarDays }
    ]
  },
  {
{ label: 'Agenda', href: '/agenda', icon: CalendarDays },
    titulo: 'Gestão',
    items: [
      { label: 'Contratos', href: '/contratos', icon: FileText },
      { label: 'Financeiro', href: '/financeiro', icon: Wallet },
      { label: 'Configurações', href: '/configuracoes', icon: Settings }
    ]
  }
]

const mobileItems = [
  { label: 'Início', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Kits', href: '/kits', icon: Package },
  { label: 'Estoque', href: '/estoque', icon: Boxes },
  { label: 'Comp.', href: '/kits/composicao', icon: Layers3 },
  { label: 'Reservas', href: '/reservas', icon: CalendarDays },
  { label: 'Financ.', href: '/financeiro', icon: Wallet },
  { label: 'Config.', href: '/configuracoes', icon: Settings }
]

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden md:flex w-76 min-w-72 flex-col border-r bg-white p-6">
        <div className="mb-8">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-100 text-pink-700 font-bold">
            CP
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Cintia Paula</h1>
          <p className="text-sm text-slate-500">Festas e Decorações</p>
        </div>

        <nav className="flex-1 space-y-6">
          {grupos.map((grupo) => (
            <div key={grupo.titulo}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {grupo.titulo}
              </p>

              <div className="space-y-1">
                {grupo.items.map((item) => {
                  const active = isActive(item.href)
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? 'bg-pink-50 text-pink-700 shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          onClick={logout}
          className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      <main className="flex-1 pb-28 md:pb-0">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-4 gap-1 border-t bg-white px-2 py-2 shadow-lg md:hidden">
        {mobileItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium ${
                active ? 'bg-pink-50 text-pink-700' : 'text-slate-500'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
