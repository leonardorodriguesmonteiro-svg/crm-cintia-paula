'use client'
import Link from 'next/link'
import { useRef, useState } from 'react'

const links = [
  { href: '/site', label: 'Início' },
  { href: '/site/kits', label: 'Kits' },
  { href: '/site/como-funciona', label: 'Como funciona' },
  { href: '/site/sobre', label: 'Sobre' },
  { href: '/site/duvidas', label: 'Dúvidas' },
  { href: '/site/contato', label: 'Contato' },
  { href: '/acompanhar', label: 'Acompanhar meu pedido' }
]
export function SitePublicoMenu() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [aberto, setAberto] = useState(false)
  function fechar() { dialog.current?.close(); setAberto(false) }
  return <>
    <nav aria-label="Menu principal" className="hidden items-center gap-1 text-sm font-bold text-slate-600 xl:flex">
      {links.map(item => <Link key={item.href} href={item.href} className={`whitespace-nowrap rounded-full px-3 py-2 hover:bg-pink-50 hover:text-pink-700 ${item.href === '/acompanhar' ? 'text-pink-700 underline underline-offset-4' : ''}`}>{item.label}</Link>)}
    </nav>
    <div className="flex items-center gap-2 xl:hidden">
      <Link href="/reservar" className="rounded-full bg-pink-600 px-3 py-2.5 text-sm font-bold text-white">Solicitar</Link>
      <button type="button" aria-label="Abrir menu" aria-haspopup="dialog" aria-expanded={aberto} aria-controls="menu-site" onClick={() => { dialog.current?.showModal(); setAberto(true) }} className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-xl">☰</button>
    </div>
    <dialog id="menu-site" ref={dialog} onClose={() => setAberto(false)} aria-label="Menu do site" className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[90%] max-w-sm border-0 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
      <div className="flex min-h-full flex-col">
        <div className="flex items-center justify-between border-b pb-4"><p className="font-bold">Cintia Paula</p><button type="button" onClick={fechar} aria-label="Fechar menu" className="h-11 w-11 rounded-full bg-slate-100 text-xl">×</button></div>
        <nav aria-label="Menu do celular" className="my-4 flex flex-1 flex-col gap-1">
          {links.map(item => <Link key={item.href} href={item.href} onClick={fechar} className={`rounded-xl px-4 py-3 text-base font-bold hover:bg-pink-50 ${item.href === '/acompanhar' ? 'bg-pink-50 text-pink-700' : ''}`}>{item.label}</Link>)}
        </nav>
        <Link href="/reservar" onClick={fechar} className="rounded-xl bg-pink-600 px-5 py-3 text-center font-bold text-white">Solicitar orçamento</Link>
      </div>
    </dialog>
  </>
}
