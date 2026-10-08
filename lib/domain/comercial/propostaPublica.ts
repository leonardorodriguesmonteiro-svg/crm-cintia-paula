export function propostaPodeEnviar(status: string, respondida: unknown = null) {
  return !respondida && ['RASCUNHO', 'FINALIZADO', 'ENVIADA'].includes(status)
}

export function propostaVisivelAoCliente(status: string) {
  return ['ENVIADA', 'ACEITA', 'RECUSADA', 'EXPIRADA', 'Enviado', 'Aprovado', 'Recusado', 'Expirado'].includes(status)
}

export function valoresItemPublico(item: {
  quantidade: number | string
  valor_unitario: number | string
  preco_unitario_orcamento?: number | string | null
  subtotal: number | string
  subtotal_negociado?: number | string | null
  desconto?: number | string | null
}) {
  return {
    quantidade: Number(item.quantidade),
    valor_unitario: Number(item.preco_unitario_orcamento ?? item.valor_unitario),
    subtotal: Number(item.subtotal_negociado ?? item.subtotal),
    desconto: Number(item.desconto ?? 0)
  }
}

export function contatoDaProposta(orcamento: { contato_nome?: string | null; contato_email?: string | null }, cliente?: { nome: string; email: string | null } | null) {
  return { nome: orcamento.contato_nome?.trim() || cliente?.nome || 'Cliente', email: orcamento.contato_email?.trim().toLowerCase() || cliente?.email?.trim().toLowerCase() || null }
}

export function linkContratoDaProposta(proposta: { status: string; reserva_id: string | null }, contrato: { public_token: string | null; status: string | null; reserva_id: string | null } | null) {
  if (proposta.status !== 'ACEITA' || !proposta.reserva_id || !contrato?.public_token || contrato.reserva_id !== proposta.reserva_id || !['Gerado', 'Enviado', 'Assinado'].includes(contrato.status || '')) return null
  return `/contrato/${contrato.public_token}`
}
