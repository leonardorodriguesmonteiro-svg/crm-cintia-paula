export type Recomendacao = {
  id: string
  prioridade: 'Alta' | 'Média' | 'Baixa'
  modulo: string
  titulo: string
  descricao: string
  href: string
}

type Reserva = {
  id: string
  data_evento: string
  status: string | null
  valor_total: number | null
  valor_sinal: number | null
  clientes: { nome: string } | null
}

type Contrato = {
  id: string
  reserva_id: string | null
  status: string | null
}

type OrdemServico = {
  id: string
  reserva_id: string | null
  status: string | null
  data_prevista: string | null
}

type Params = {
  reservas: Reserva[]
  contratos: Contrato[]
  ordens: OrdemServico[]
  hoje: string
}

export function gerarRecomendacoes({
  reservas,
  contratos,
  ordens,
  hoje
}: Params): Recomendacao[] {
  const recomendacoes: Recomendacao[] = []

  const dataHoje = new Date(`${hoje}T12:00:00`)
  const dataAmanha = new Date(dataHoje)
  dataAmanha.setDate(dataAmanha.getDate() + 1)
  const amanha = dataAmanha.toISOString().slice(0, 10)

  for (const reserva of reservas) {
    if (reserva.status === 'Cancelada') continue

    const contrato = contratos.find(
      item => item.reserva_id === reserva.id
    )

    const ordem = ordens.find(
      item => item.reserva_id === reserva.id
    )

    const nomeCliente =
      reserva.clientes?.nome || 'Cliente não informado'

    const saldo = Math.max(
      Number(reserva.valor_total || 0) -
        Number(reserva.valor_sinal || 0),
      0
    )

    if (
      reserva.data_evento === amanha &&
      (!contrato || contrato.status !== 'Assinado')
    ) {
      recomendacoes.push({
        id: `contrato-${reserva.id}`,
        prioridade: 'Alta',
        modulo: 'Jurídico',
        titulo: 'Contrato pendente para evento amanhã',
        descricao: `${nomeCliente} possui evento amanhã e o contrato ainda não está assinado.`,
        href: `/reservas/${reserva.id}`
      })
    }

    if (
      reserva.data_evento <= amanha &&
      saldo > 0
    ) {
      recomendacoes.push({
        id: `saldo-${reserva.id}`,
        prioridade: reserva.data_evento === hoje ? 'Alta' : 'Média',
        modulo: 'Financeiro',
        titulo: 'Saldo pendente próximo ao evento',
        descricao: `${nomeCliente} possui saldo pendente de R$ ${saldo.toFixed(2)}.`,
        href: `/reservas/${reserva.id}`
      })
    }

    if (
      reserva.data_evento <= amanha &&
      (!ordem || ordem.status !== 'Concluída')
    ) {
      recomendacoes.push({
        id: `os-${reserva.id}`,
        prioridade: reserva.data_evento === hoje ? 'Alta' : 'Média',
        modulo: 'Operação',
        titulo: 'Ordem de Serviço pendente',
        descricao: `${nomeCliente} possui evento próximo e a operação ainda não foi concluída.`,
        href: `/reservas/${reserva.id}`
      })
    }
  }

  const peso = {
    Alta: 1,
    Média: 2,
    Baixa: 3
  }

  return recomendacoes.sort(
    (a, b) => peso[a.prioridade] - peso[b.prioridade]
  )
}
