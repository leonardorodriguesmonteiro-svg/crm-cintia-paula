export const statusPreReserva = [
  'RECEBIDA',
  'EM_ANALISE',
  'AJUSTE_SOLICITADO',
  'APROVADA',
  'RECUSADA',
  'CONVERTIDA_EM_PROPOSTA'
] as const

export const statusProposta = [
  'RASCUNHO',
  'ENVIADA',
  'ACEITA',
  'RECUSADA',
  'EXPIRADA',
  'CANCELADA'
] as const

export const statusFormalizacao = [
  'AGUARDANDO_DADOS',
  'DADOS_COMPLETOS',
  'CONTRATO_GERADO',
  'CONTRATO_ENVIADO',
  'AGUARDANDO_ASSINATURA',
  'AGUARDANDO_PAGAMENTO',
  'PRONTA_PARA_CONFIRMAR',
  'RESERVA_CONFIRMADA',
  'CANCELADA'
] as const

export type StatusPreReserva = (typeof statusPreReserva)[number]
export type StatusProposta = (typeof statusProposta)[number]
export type StatusFormalizacao = (typeof statusFormalizacao)[number]

const transicoesPreReserva: Record<StatusPreReserva, readonly StatusPreReserva[]> = {
  RECEBIDA: ['EM_ANALISE', 'RECUSADA'],
  EM_ANALISE: ['AJUSTE_SOLICITADO', 'APROVADA', 'RECUSADA'],
  AJUSTE_SOLICITADO: ['EM_ANALISE', 'RECUSADA'],
  APROVADA: ['CONVERTIDA_EM_PROPOSTA', 'EM_ANALISE', 'RECUSADA'],
  RECUSADA: [],
  CONVERTIDA_EM_PROPOSTA: []
}

const transicoesProposta: Record<StatusProposta, readonly StatusProposta[]> = {
  RASCUNHO: ['ENVIADA', 'CANCELADA'],
  ENVIADA: ['ACEITA', 'RECUSADA', 'EXPIRADA', 'CANCELADA'],
  ACEITA: ['CANCELADA'],
  RECUSADA: [],
  EXPIRADA: [],
  CANCELADA: []
}

export function podeTransicionarPreReserva(
  atual: StatusPreReserva,
  proximo: StatusPreReserva
) {
  return transicoesPreReserva[atual].includes(proximo)
}

export function proximosStatusPreReserva(atual: StatusPreReserva) {
  return [...transicoesPreReserva[atual]]
}

export function podeTransicionarProposta(
  atual: StatusProposta,
  proximo: StatusProposta
) {
  return transicoesProposta[atual].includes(proximo)
}

export type RequisitosConfirmacaoReserva = {
  propostaAceita: boolean
  dadosClienteCompletos: boolean
  contratoAssinado: boolean
  pagamentoConfirmado: boolean
  disponibilidadeValida: boolean
  reservaExistente: boolean
}

export function pendenciasParaConfirmarReserva(
  requisitos: RequisitosConfirmacaoReserva
) {
  const pendencias: string[] = []

  if (!requisitos.propostaAceita) pendencias.push('PROPOSTA_NAO_ACEITA')
  if (!requisitos.dadosClienteCompletos) pendencias.push('DADOS_CLIENTE_INCOMPLETOS')
  if (!requisitos.contratoAssinado) pendencias.push('CONTRATO_NAO_ASSINADO')
  if (!requisitos.pagamentoConfirmado) pendencias.push('PAGAMENTO_NAO_CONFIRMADO')
  if (!requisitos.disponibilidadeValida) pendencias.push('DISPONIBILIDADE_INVALIDA')
  if (requisitos.reservaExistente) pendencias.push('RESERVA_JA_EXISTE')

  return pendencias
}

export function podeConfirmarReserva(
  requisitos: RequisitosConfirmacaoReserva
) {
  return pendenciasParaConfirmarReserva(requisitos).length === 0
}
