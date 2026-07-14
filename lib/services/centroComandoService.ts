type Reserva = {
  id: string
  data_evento: string
  horario_evento: string | null
  status: string | null
  valor_total: number | null
  valor_sinal: number | null
  clientes: { nome: string } | null
  kits: { nome: string } | null
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

type Logistica = {
  id: string
  etapa: string
  status: string | null
  horario_previsto: string | null
}

type CalcularCentroComandoParams = {
  reservas: Reserva[]
  contratos: Contrato[]
  ordens: OrdemServico[]
  logistica: Logistica[]
  hoje: string
}

export function calcularCentroComando({
  reservas,
  contratos,
  ordens,
  logistica,
  hoje
}: CalcularCentroComandoParams) {
  const eventosHoje = reservas.filter(
    reserva => reserva.data_evento === hoje && reserva.status !== 'Cancelada'
  )

  const eventosAmanha = reservas.filter(reserva => {
    const amanha = new Date(`${hoje}T12:00:00`)
    amanha.setDate(amanha.getDate() + 1)

    return (
      reserva.data_evento === amanha.toISOString().slice(0, 10) &&
      reserva.status !== 'Cancelada'
    )
  })

  const proximosEventos = reservas
    .filter(
      reserva =>
        reserva.data_evento >= hoje &&
        reserva.status !== 'Cancelada'
    )
    .slice(0, 6)

  const contratosPendentes = contratos.filter(
    contrato =>
      contrato.status !== 'Assinado' &&
      contrato.status !== 'Cancelado'
  ).length

  const osPendentes = ordens.filter(
    ordem => ordem.status !== 'Concluída'
  ).length

  const entregasHoje = logistica.filter(
    item =>
      item.etapa === 'Entrega' &&
      item.horario_previsto?.slice(0, 10) === hoje &&
      item.status !== 'Concluído'
  ).length

  const retiradasHoje = logistica.filter(
    item =>
      item.etapa === 'Devolução' &&
      item.horario_previsto?.slice(0, 10) === hoje &&
      item.status !== 'Concluído'
  ).length

  const receberHoje = eventosHoje.reduce((total, reserva) => {
    const saldo = Math.max(
      Number(reserva.valor_total || 0) -
        Number(reserva.valor_sinal || 0),
      0
    )

    return total + saldo
  }, 0)

  return {
    eventosHoje,
    eventosAmanha,
    proximosEventos,
    contratosPendentes,
    osPendentes,
    entregasHoje,
    retiradasHoje,
    receberHoje,
    totalPendencias: contratosPendentes + osPendentes
  }
}
