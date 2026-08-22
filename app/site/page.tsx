import Link from 'next/link'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

const etapas = [
  ['1', 'Escolha seu estilo', 'Veja kits prontos ou monte sua própria composição.'],
  ['2', 'Informe a data', 'Envie os dados da festa para consultarmos a disponibilidade.'],
  ['3', 'Receba a proposta', 'Nossa equipe analisa a solicitação e prepara o orçamento.'],
  ['4', 'Formalize a reserva', 'Após aceite, contrato e pagamento, sua reserva é confirmada.']
]

export default function SiteHomePage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="bg-gradient-to-br from-pink-50 via-white to-rose-50 px-4 py-16 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-pink-600">Pegue e Monte</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                Uma festa bonita, prática e com a sua cara.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Escolha um kit pronto, monte uma composição personalizada e faça sua solicitação de reserva online.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/site/kits" className="rounded-full bg-pink-600 px-6 py-3 font-black text-white shadow-sm hover:bg-pink-700">
                  Ver kits
                </Link>
                <Link href="/reservar" className="rounded-full border border-pink-200 bg-white px-6 py-3 font-black text-pink-700 hover:bg-pink-50">
                  Montar minha festa
                </Link>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['🎉', 'Kits prontos', 'Composições definidas e valores cadastrados.'],
                ['✨', 'Monte seu kit', 'Escolha itens e crie uma composição personalizada.'],
                ['📅', 'Reserva online', 'Envie a data e acompanhe a formalização da solicitação.'],
                ['📝', 'Contrato e pagamento', 'Fluxo integrado para concluir sua reserva com segurança.']
              ].map(([icone, titulo, texto]) => (
                <div key={titulo} className="rounded-3xl border border-pink-100 bg-white p-6 shadow-sm">
                  <span className="text-3xl">{icone}</span>
                  <h2 className="mt-4 text-lg font-black">{titulo}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Como funciona</p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">Da escolha à reserva em poucos passos</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {etapas.map(([numero, titulo, texto]) => (
              <div key={numero} className="rounded-3xl border border-slate-200 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 font-black text-pink-700">{numero}</div>
                <h3 className="mt-5 text-lg font-black">{titulo}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/site/como-funciona" className="font-black text-pink-700">Entender todo o processo →</Link>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-16 text-white md:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-400">Comece pela inspiração</p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">Encontre o kit ideal para a sua comemoração.</h2>
            <p className="mt-5 max-w-2xl text-slate-300">Consulte nosso catálogo e envie sua solicitação diretamente para a equipe.</p>
            <Link href="/reservar" className="mt-8 rounded-full bg-pink-500 px-7 py-3 font-black text-white hover:bg-pink-400">
              Escolher meu kit
            </Link>
          </div>
        </section>
      </main>
    </SitePublicoLayout>
  )
}
