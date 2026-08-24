import Link from 'next/link'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

export default function SobrePage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="bg-pink-50 px-4 py-16 md:px-8">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Sobre nós</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black md:text-5xl">Cintia Paula Festas &amp; Decorações</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
              Trabalhamos com locação de peças e kits para festas no modelo Pegue e Monte, buscando tornar a organização mais prática, visual e acessível para cada cliente.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3 md:px-8">
          {[
            ['Praticidade', 'Escolha composições prontas ou monte seu próprio kit de acordo com o estilo da comemoração.'],
            ['Organização', 'Orçamento, contrato, pagamento e reserva passam por um fluxo integrado ao nosso sistema.'],
            ['Personalização', 'Além dos kits prontos, você pode combinar peças para criar uma composição personalizada.']
          ].map(([titulo, texto]) => (
            <div key={titulo} className="rounded-3xl border border-slate-200 p-7">
              <h2 className="text-xl font-black">{titulo}</h2>
              <p className="mt-3 leading-7 text-slate-600">{texto}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-12 text-center md:px-8">
          <div className="rounded-3xl bg-slate-950 px-6 py-10 text-white">
            <h2 className="text-3xl font-black">Vamos começar a montar sua festa?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">Conheça os kits disponíveis ou envie uma solicitação personalizada.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/site/kits" className="rounded-full bg-white px-5 py-3 font-black text-slate-950">Ver kits</Link>
              <Link href="/reservar" className="rounded-full bg-pink-500 px-5 py-3 font-black text-white">Solicitar reserva</Link>
            </div>
          </div>
        </section>
      </main>
    </SitePublicoLayout>
  )
}
