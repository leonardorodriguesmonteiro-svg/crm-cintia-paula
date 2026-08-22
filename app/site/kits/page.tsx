import type { Metadata } from 'next'
import { CatalogoPublicoResumo } from '@/components/publico/CatalogoPublicoResumo'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

export const metadata: Metadata = {
  title: 'Kits | Cintia Paula Festas & Decorações',
  description: 'Conheça kits e composições para sua festa.'
}

export default function KitsPublicosPage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="bg-pink-50 px-4 py-14 md:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Catálogo</p>
            <h1 className="mt-3 text-4xl font-black md:text-5xl">Kits para diferentes estilos de festa</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              Veja algumas opções disponíveis. A disponibilidade final é confirmada no momento da formalização da reserva.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <CatalogoPublicoResumo />
        </section>
      </main>
    </SitePublicoLayout>
  )
}
