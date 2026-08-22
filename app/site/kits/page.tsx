import type { Metadata } from 'next'
import Link from 'next/link'
import { CatalogoPublicoResumo } from '@/components/publico/CatalogoPublicoResumo'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

export const metadata: Metadata = {
  title: 'Kits para festas | Cintia Paula Festas & Decorações',
  description: 'Explore kits para festas, compare estilos e valores e envie sua solicitação de reserva online.'
}

export default function KitsPublicosPage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="overflow-hidden bg-gradient-to-br from-pink-50 via-white to-rose-50 px-4 py-14 md:px-8 md:py-20">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_360px]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-pink-600">Catálogo Cintia Paula</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">Encontre o cenário que combina com a sua festa.</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">
                Explore nossos kits com fotos do catálogo, compare temas e valores e escolha a composição que mais combina com a sua comemoração.
              </p>
              <div className="mt-7 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm">🎉 Kits prontos</span>
                <span className="rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm">📷 Fotos do catálogo</span>
                <span className="rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm">💳 Valores cadastrados</span>
                <span className="rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm">📅 Solicitação online</span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-pink-100 bg-white p-6 shadow-xl shadow-pink-100/50">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">Quer algo exclusivo?</p>
              <h2 className="mt-2 text-2xl font-black">Monte seu próprio kit</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Escolha peças do estoque e envie sua composição para receber um orçamento personalizado.</p>
              <Link href="/reservar" className="mt-5 inline-flex w-full justify-center rounded-2xl bg-slate-950 px-5 py-3 font-black text-white transition hover:bg-pink-700">
                Montar minha festa →
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
          <CatalogoPublicoResumo />
        </section>
      </main>
    </SitePublicoLayout>
  )
}
