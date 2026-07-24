'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Layers3,
  ClipboardList,
  MessageSquareText
} from 'lucide-react'

const grupos = [
  {
    titulo: 'Dashboard',
    items: [
      { label: 'Início', href: '/dashboard', icon: LayoutDashboard }
    ]
  },
  {
    titulo: 'Comercial',
    items: [
      { label: 'Clientes', href: '/clientes', icon: Users },
      { label: 'Reservas', href: '/reservas', icon: ClipboardList },
      { label: 'Agenda', href: '/agenda', icon: CalendarDays },
      { label: 'Contratos', href: '/contratos', icon: FileText }
    ]
  },
  {
    titulo: 'Operação',
    items: [
      { label: 'Kits', href: '/kits', icon: Package },
      { label: 'Composição', href: '/kits/composicao', icon: Layers3 },
      { label: 'Estoque', href: '/estoque', icon: Boxes }
    ]
  },
  {
    titulo: 'Gestão',
    items: [
      { label: 'Financeiro', href: '/financeiro', icon: Wallet },
      { label: 'Feedbacks', href: '/administracao/feedbacks', icon: MessageSquareText },
      { label: 'Configurações', href: '/configuracoes', icon: Settings }
    ]
  }
]

const mobileItems = [
  { label: 'Início', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clientes', href: '/clientes', icon: Users },
  { label: 'Reservas', href: '/reservas', icon: ClipboardList },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays },
  { label: 'Kits', href: '/kits', icon: Package },
  { label: 'Estoque', href: '/estoque', icon: Boxes },
  { label: 'Financeiro', href: '/financeiro', icon: Wallet },
  { label: 'Config.', href: '/configuracoes', icon: Settings }
]

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [saindo, setSaindo] = useState(false)

  function limparSessaoLocal() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (!supabaseUrl) return

    try {
      const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
      const storageKey = `sb-${projectRef}-auth-token`
      localStorage.removeItem(storageKey)
      localStorage.removeItem(`${storageKey}-code-verifier`)
    } catch {
      // A navegação para o login ainda impede o acesso às rotas protegidas.
    }
  }

  async function logout() {
    setSaindo(true)
    const redirecionar = () => {
      limparSessaoLocal()
      window.location.replace('/login')
    }
    const fallback = window.setTimeout(redirecionar, 1500)

    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      window.clearTimeout(fallback)
      redirecionar()
    }
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-sm font-bold text-pink-700">
            CP
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-900">Cintia Paula</span>
            <span className="block text-[11px] text-slate-500">Festas e Decorações</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/administracao/feedbacks"
            aria-label="Abrir Central de Feedback"
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              isActive('/administracao/feedbacks')
                ? 'border-pink-200 bg-pink-50 text-pink-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquareText size={18} />
          </Link>

          <button
            type="button"
            onClick={logout}
            disabled={saindo}
            aria-label="Sair do sistema"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut size={17} />
            {saindo ? 'Saindo...' : 'Sair'}
          </button>
        </div>
      </header>

      <aside className="hidden md:flex w-72 flex-col border-r bg-white p-6">
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
                  const Icon = item.icon
                  const active = isActive(item.href)

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
          disabled={saindo}
          className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <LogOut size={18} />
          {saindo ? 'Saindo...' : 'Sair'}
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
