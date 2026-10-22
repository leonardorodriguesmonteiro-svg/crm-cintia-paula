import Link from 'next/link'
import type { ReactNode } from 'react'
import { SitePublicoMenu } from '@/components/publico/SitePublicoMenu'

export function SitePublicoLayout({ children }: { children: ReactNode }) {
  return <div className="site-publico min-h-screen">
    <a href="#conteudo-site" className="brand-skip">Ir para o conteúdo</a>
    <header className="brand-header">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-8">
        <Link href="/site" className="brand-logo" aria-label="Cintia Paula Festas e Decorações — início"><img src="/brand/cintia-paula.jpg" alt="Cintia Paula Festas e Decorações" width={1536} height={1024} /></Link>
        <div className="flex items-center gap-3"><SitePublicoMenu /><div className="hidden xl:block"><Link href="/reservar" className="brand-button">Solicitar orçamento</Link></div></div>
      </div>
    </header>
    <div id="conteudo-site" tabIndex={-1}>{children}</div>
    <footer className="brand-footer">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.3fr_1fr_1fr] md:px-8">
        <div><Link href="/site"><img src="/brand/cintia-paula.jpg" alt="Cintia Paula Festas e Decorações" width={1536} height={1024} loading="lazy" className="w-64 rounded-xl" /></Link><p className="mt-4 max-w-xs text-sm leading-6">Transformando momentos em grandes memórias, com carinho em cada detalhe.</p></div>
        <div><h2 className="mb-5 text-sm font-semibold">Explore</h2><nav aria-label="Links do rodapé" className="flex flex-col gap-3 text-sm"><Link href="/site/kits">Nossas decorações</Link><Link href="/site/como-funciona">Como funciona</Link><Link href="/site/sobre">Sobre a Cintia Paula</Link><Link href="/site/duvidas">Dúvidas frequentes</Link></nav></div>
        <div><h2 className="mb-5 text-sm font-semibold">Vamos conversar sobre sua festa?</h2><nav aria-label="Atendimento" className="flex flex-col gap-3 text-sm"><Link href="/reservar">Solicitar orçamento →</Link><Link href="/acompanhar">Acompanhar meu pedido</Link><Link href="/site/contato">Contato e localização</Link></nav><p className="mt-7 text-xs leading-6">Rio de Janeiro · RJ<br />Festas que ficam na memória.</p></div>
      </div>
      <div className="brand-footer-bottom">Cintia Paula · Festas &amp; Decorações</div>
    </footer>
  </div>
}
