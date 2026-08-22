'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const links = [
  { href: '/site', label: 'Início' },
  { href: '/site/kits', label: 'Kits' },
  { href: '/site/como-funciona', label: 'Como funciona' },
  { href: '/site/sobre', label: 'Sobre' },
  { href: '/site/duvidas', label: 'Dúvidas' },
  { href: '/site/contato', label: 'Contato' }
]

export function SitePublicoMenu() {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAberto(false)
    }
    window.addEventListener('keydown', fecharComEscape)
    return () => window.removeEventListener('keydown', fecharComEscape)
  }, [aberto])

  return (
    <>
      <nav className="hidden items-center gap-1 text-sm font-bold text-slate-600 md:flex">
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

      <div className="flex items-center gap-2 md:hidden">
        <Link
          href="/reservar"
          className="rounded-full bg-pink-600 px-4 py-2.5 text-xs font-black text-white shadow-sm"
        >
          Reservar
        </Link>
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xl font-black text-slate-800 shadow-sm"
        >
          ☰
        </button>
      </div>

      {aberto ? (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Cintia Paula</p>
                <p className="font-black">Festas &amp; Decorações</p>
              </div>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg font-black"
              >
                ×
              </button>
            </div>

            <nav className="mt-5 flex flex-1 flex-col gap-1">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setAberto(false)}
                  className="rounded-2xl px-4 py-3.5 text-base font-black text-slate-800 transition hover:bg-pink-50 hover:text-pink-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-slate-100 pt-5">
              <p className="mb-3 text-sm leading-6 text-slate-500">Escolha um kit pronto ou monte sua própria composição.</p>
              <Link
                href="/reservar"
                onClick={() => setAberto(false)}
                className="flex w-full items-center justify-center rounded-2xl bg-pink-600 px-5 py-3.5 font-black text-white"
              >
                Começar minha reserva
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}
