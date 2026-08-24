import Link from 'next/link'
import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'

const perguntas = [
  ['A seleção do kit já garante a reserva?', 'Não. A seleção inicia a solicitação. A reserva é confirmada somente depois da análise, aceite, contrato assinado e pagamento.'],
  ['O estoque fica bloqueado quando eu envio a solicitação?', 'Não. O bloqueio do estoque acontece somente na confirmação definitiva da reserva.'],
  ['Posso montar um kit personalizado?', 'Sim. Você pode selecionar itens do catálogo e nossa equipe prepara o orçamento da composição personalizada.'],
  ['Como recebo o orçamento?', 'Após a análise da solicitação, a proposta é preparada com os itens e valores correspondentes.'],
  ['A reserva possui contrato?', 'Sim. Depois do aceite e do preenchimento dos dados necessários, o contrato é preparado para assinatura digital.'],
  ['Quando a reserva é considerada confirmada?', 'Quando as etapas de assinatura do contrato e pagamento estiverem concluídas e o sistema confirmar a disponibilidade final.'],
  ['Posso escolher retirada ou entrega?', 'A solicitação permite informar a preferência. A modalidade e demais condições são confirmadas durante o atendimento.']
]

export default function DuvidasPage() {
  return (
    <SitePublicoLayout>
      <main>
        <section className="bg-pink-50 px-4 py-14 md:px-8">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Perguntas frequentes</p>
            <h1 className="mt-3 text-4xl font-black md:text-5xl">Tire suas dúvidas antes de reservar</h1>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-12 md:px-8">
          <div className="space-y-4">
            {perguntas.map(([pergunta, resposta]) => (
              <details key={pergunta} className="group rounded-2xl border border-slate-200 bg-white p-5">
                <summary className="cursor-pointer list-none font-black">{pergunta}</summary>
                <p className="mt-3 leading-7 text-slate-600">{resposta}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <p className="text-slate-600">Pronto para começar?</p>
            <Link href="/reservar" className="mt-4 inline-flex rounded-full bg-pink-600 px-6 py-3 font-black text-white hover:bg-pink-700">
              Solicitar reserva
            </Link>
          </div>
        </section>
      </main>
    </SitePublicoLayout>
  )
}
