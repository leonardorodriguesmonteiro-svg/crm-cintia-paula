type Props = {
  eventosHoje: number
  entregasHoje: number
  retiradasHoje: number
  contratosPendentes: number
  osPendentes: number
  receberHoje: number
}

export function MissaoDoDia({
  eventosHoje,
  entregasHoje,
  retiradasHoje,
  contratosPendentes,
  osPendentes,
  receberHoje
}: Props) {
  const tarefas = [
    { texto: `Acompanhar ${eventosHoje} evento(s) hoje`, concluida: eventosHoje === 0 },
    { texto: `Realizar ${entregasHoje} entrega(s)`, concluida: entregasHoje === 0 },
    { texto: `Realizar ${retiradasHoje} retirada(s)`, concluida: retiradasHoje === 0 },
    { texto: `Resolver ${contratosPendentes} contrato(s) pendente(s)`, concluida: contratosPendentes === 0 },
    { texto: `Concluir ${osPendentes} Ordem(ns) de Serviço`, concluida: osPendentes === 0 },
    {
      texto: `Receber R$ ${receberHoje.toFixed(2)}`,
      concluida: receberHoje <= 0
    }
  ]

  const concluidas = tarefas.filter(item => item.concluida).length
  const progresso = Math.round((concluidas / tarefas.length) * 100)

  return (
    <div className="rounded-3xl border bg-white p-5 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">MISSÃO DE HOJE</p>
          <h2 className="text-xl font-bold text-slate-900">
            Prioridades da operação
          </h2>
        </div>

        <span className="w-fit rounded-full bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700">
          {progresso}% concluído
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {tarefas.map(item => (
          <div
            key={item.texto}
            className={`rounded-xl border px-4 py-3 text-sm ${
              item.concluida
                ? 'bg-green-50 text-green-700'
                : 'bg-slate-50 text-slate-700'
            }`}
          >
            {item.concluida ? '✓' : '○'} {item.texto}
          </div>
        ))}
      </div>

      <div className="mt-5 h-3 rounded-full bg-slate-100">
        <div
          className="h-3 rounded-full bg-pink-600 transition-all"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  )
}
