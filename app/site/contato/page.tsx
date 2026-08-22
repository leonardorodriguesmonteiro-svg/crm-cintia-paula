import Link from 'next/link'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

export default function ContatoPage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="bg-gradient-to-br from-pink-50 to-white px-4 py-14 md:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Contato</p>
            <h1 className="mt-3 text-4xl font-black md:text-5xl">Vamos conversar sobre a sua festa</h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Para orçamento e disponibilidade, a forma mais rápida é iniciar a solicitação pelo site. Assim sua escolha já chega organizada para nossa equipe.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-5 px-4 py-12 md:grid-cols-2 md:px-8">
          <div className="rounded-3xl border border-slate-200 p-7">
            <span className="text-3xl">🎉</span>
            <h2 className="mt-4 text-2xl font-black">Quero fazer uma reserva</h2>
            <p className="mt-3 leading-7 text-slate-600">Escolha um kit ou monte uma composição personalizada e envie os dados da sua festa.</p>
            <Link href="/reservar" className="mt-6 inline-flex rounded-full bg-pink-600 px-5 py-3 font-black text-white hover:bg-pink-700">
              Iniciar solicitação
            </Link>
          </div>

          <div className="rounded-3xl border border-slate-200 p-7">
            <span className="text-3xl">✉️</span>
            <h2 className="mt-4 text-2xl font-black">Atendimento</h2>
            <p className="mt-3 leading-7 text-slate-600">Se você já possui uma solicitação ou precisa tratar de outro assunto, fale com nossa equipe pelo canal de atendimento.</p>
            <a href="mailto:contato@cintiapaulafestas.com.br" className="mt-6 inline-block font-black text-pink-700">
              contato@cintiapaulafestas.com.br
            </a>
          </div>
        </section>
      </main>
    </SitePublicoLayout>
  )
}
