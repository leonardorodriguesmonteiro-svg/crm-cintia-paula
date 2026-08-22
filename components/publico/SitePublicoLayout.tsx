import Link from 'next/link'
import type { ReactNode } from 'react'
import { SitePublicoMenu } from '@/components/publico/SitePublicoMenu'

export function SitePublicoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-pink-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <Link href="/site" className="min-w-fit">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Cintia Paula</p>
            <p className="text-base font-black md:text-lg">Festas &amp; Decorações</p>
          </Link>

          <div className="flex items-center gap-3">
            <SitePublicoMenu />
            <Link
              href="/reservar"
              className="hidden rounded-full bg-pink-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-pink-700 md:inline-flex"
            >
              Reservar agora
            </Link>
          </div>
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
              <Link href="/site/kits">Conhecer os kits</Link>
              <Link href="/site/como-funciona">Como funciona</Link>
              <Link href="/site/duvidas">Dúvidas frequentes</Link>
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
