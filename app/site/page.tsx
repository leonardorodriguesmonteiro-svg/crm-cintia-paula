import Link from 'next/link'
import { HomeKitsDestaque } from '@/components/publico/HomeKitsDestaque'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

const etapas = [
  ['1', 'Escolha seu estilo', 'Veja os kits prontos ou monte uma composição personalizada.'],
  ['2', 'Informe a data', 'Envie os dados da festa para consultarmos a disponibilidade.'],
  ['3', 'Receba a proposta', 'Nossa equipe analisa a solicitação e prepara o orçamento.'],
  ['4', 'Formalize a reserva', 'Após aceite, contrato e pagamento, sua reserva é confirmada.']
]

export default function SiteHomePage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="overflow-hidden bg-gradient-to-br from-pink-50 via-white to-rose-50 px-4 py-14 md:px-8 md:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.08fr_.92fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-pink-700 shadow-sm">
                <span>✦</span> Pegue e Monte
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl lg:text-7xl">
                Sua festa bonita, prática e com a sua cara.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                Encontre uma inspiração, escolha seu kit e envie sua pré-reserva online. Se preferir, monte uma composição personalizada com peças do nosso acervo.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/site/kits" className="rounded-full bg-pink-600 px-6 py-3.5 font-black text-white shadow-lg shadow-pink-200/60 transition hover:-translate-y-0.5 hover:bg-pink-700">
                  Explorar os kits
                </Link>
                <Link href="/reservar" className="rounded-full border border-pink-200 bg-white px-6 py-3.5 font-black text-pink-700 transition hover:bg-pink-50">
                  Montar meu kit
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-slate-500">
                <span>✓ Catálogo conectado ao ERP</span>
                <span>✓ Reserva online</span>
                <span>✓ Contrato e pagamento integrados</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-10 -top-8 h-40 w-40 rounded-full bg-pink-200/40 blur-3xl" />
              <div className="absolute -bottom-10 -right-8 h-48 w-48 rounded-full bg-rose-200/50 blur-3xl" />
              <div className="relative rounded-[2.5rem] border border-white/80 bg-white/90 p-5 shadow-2xl shadow-pink-100/70 backdrop-blur md:p-7">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Do sonho à reserva</p>
                <h2 className="mt-2 text-2xl font-black md:text-3xl">Tudo em um só fluxo.</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    ['🎉', 'Kits prontos', 'Fotos, temas e valores do catálogo real.'],
                    ['✨', 'Monte seu kit', 'Escolha peças e crie sua composição.'],
                    ['📅', 'Pré-reserva', 'Informe a data e envie sua solicitação.'],
                    ['📝', 'Formalização', 'Proposta, contrato e pagamento no mesmo processo.']
                  ].map(([icone, titulo, texto]) => (
                    <div key={titulo} className="rounded-3xl border border-pink-100 bg-white p-5 shadow-sm">
                      <span className="text-3xl">{icone}</span>
                      <h3 className="mt-3 font-black">{titulo}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{texto}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-400">Mais rápido</p>
                  <p className="mt-2 text-lg font-black">Gostou de um kit?</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">Na vitrine, clique em “Quero este kit” e ele já abre selecionado na Reserva Expressa.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <HomeKitsDestaque />

        <section className="bg-slate-50 px-4 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Como funciona</p>
              <h2 className="mt-3 text-3xl font-black md:text-5xl">Da escolha à reserva em poucos passos</h2>
              <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Você escolhe a composição e o sistema organiza a jornada até a confirmação definitiva.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {etapas.map(([numero, titulo, texto]) => (
                <div key={numero} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pink-100 font-black text-pink-700">{numero}</div>
                  <h3 className="mt-5 text-lg font-black">{titulo}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{texto}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link href="/site/como-funciona" className="font-black text-pink-700">Entender todo o processo →</Link>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 md:px-8 md:py-20">
          <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
            {[
              ['Catálogo sempre conectado', 'Os kits exibidos no site vêm do mesmo catálogo usado na gestão da operação.'],
              ['Escolha sem compromisso', 'A seleção inicial não bloqueia o estoque. A disponibilidade é revalidada antes da confirmação.'],
              ['Jornada organizada', 'Pré-reserva, proposta, contrato e pagamento seguem um fluxo único e rastreável.']
            ].map(([titulo, texto], index) => (
              <div key={titulo} className="rounded-[2rem] border border-slate-200 p-7">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">0{index + 1}</p>
                <h2 className="mt-3 text-xl font-black">{titulo}</h2>
                <p className="mt-3 leading-7 text-slate-600">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-16 text-white md:px-8 md:py-20">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-400">Sua festa começa aqui</p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">Encontre o kit ideal ou crie algo só seu.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Explore as inspirações, escolha seu kit e avance direto para a pré-reserva.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/site/kits" className="rounded-full bg-pink-500 px-7 py-3.5 font-black text-white transition hover:bg-pink-400">
                Ver todos os kits
              </Link>
              <Link href="/reservar" className="rounded-full border border-slate-700 px-7 py-3.5 font-black text-white transition hover:bg-slate-900">
                Montar meu kit
              </Link>
            </div>
          </div>
        </section>
      </main>
    </SitePublicoLayout>
  )
}
