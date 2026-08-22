import Link from 'next/link'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

const etapas = [
  ['Escolha', 'Selecione um kit pronto ou monte sua própria composição com itens do catálogo.'],
  ['Pré-reserva', 'Informe seus dados, data da festa e preferência de retirada ou entrega.'],
  ['Análise', 'Nossa equipe verifica disponibilidade, composição e condições da solicitação.'],
  ['Proposta', 'Você recebe o orçamento com os itens e valores definidos para aprovação.'],
  ['Contrato', 'Após o aceite e complemento dos dados, o contrato é preparado para assinatura digital.'],
  ['Pagamento', 'Com contrato assinado e pagamento realizado, a reserva é confirmada.'],
  ['Retirada ou entrega', 'A operação é organizada de acordo com o combinado para sua festa.'],
  ['Devolução', 'Após a devolução, a reserva é encerrada no sistema.']
]

export default function ComoFuncionaPage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="bg-gradient-to-br from-pink-50 to-white px-4 py-14 md:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Passo a passo</p>
            <h1 className="mt-3 text-4xl font-black md:text-5xl">Como funciona o Pegue e Monte</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              Um fluxo simples desde a escolha dos itens até a conclusão da sua reserva.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 md:px-8">
          <div className="grid gap-4 md:grid-cols-2">
            {etapas.map(([titulo, texto], index) => (
              <div key={titulo} className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 font-black text-pink-700">{index + 1}</div>
                <h2 className="mt-4 text-xl font-black">{titulo}</h2>
                <p className="mt-2 leading-7 text-slate-600">{texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/reservar" className="inline-flex rounded-full bg-pink-600 px-6 py-3 font-black text-white hover:bg-pink-700">
              Começar minha reserva
            </Link>
          </div>
        </section>
      </main>
    </SitePublicoLayout>
  )
}
