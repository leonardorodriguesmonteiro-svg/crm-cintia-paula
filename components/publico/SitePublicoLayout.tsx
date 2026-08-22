import Link from 'next/link'
import type { ReactNode } from 'react'

const links = [
  { href: '/', label: 'Início' },
  { href: '/kits', label: 'Kits' },
  { href: '/como-funciona', label: 'Como funciona' },
  { href: '/sobre', label: 'Sobre' },
  { href: '/duvidas', label: 'Dúvidas' },
  { href: '/contato', label: 'Contato' }
]

export function SitePublicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-pink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Link href="/" className="min-w-fit">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Cintia Paula</p>
            <p className="text-base font-black md:text-lg">Festas &amp; Decorações</p>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto pb-1 text-sm font-bold text-slate-600 md:order-2 md:w-auto md:pb-0">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full px-3 py-2 transition hover:bg-pink-50 hover:text-pink-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/reservar"
            className="order-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-pink-700 md:order-3"
          >
            Reservar agora
          </Link>
        </div>
      </header>

      {children}

      <footer className="mt-16 border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-400">Cintia Paula</p>
            <p className="mt-2 text-xl font-black">Festas &amp; Decorações</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
              Pegue e Monte com escolha de kits, orçamento e reserva conectados ao nosso sistema de gestão.
            </p>
          </div>

          <div>
            <p className="font-black">Navegação</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
              <Link href="/kits">Conhecer os kits</Link>
              <Link href="/como-funciona">Como funciona</Link>
              <Link href="/duvidas">Dúvidas frequentes</Link>
              <Link href="/reservar">Solicitar reserva</Link>
            </div>
          </div>

          <div>
            <p className="font-black">Sua festa começa aqui</p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Escolha um kit pronto ou monte uma composição personalizada com itens do nosso catálogo.
            </p>
            <Link href="/reservar" className="mt-4 inline-block font-black text-pink-400">
              Começar agora →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
