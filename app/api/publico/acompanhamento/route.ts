import { NextRequest, NextResponse } from 'next/server'
import { hashToken, tokenValido } from '@/lib/server/acompanhamento'
import { empresaDoSite, hashDoSolicitante, origemEhPermitida } from '@/lib/server/publicPreReservation'
import { comercialJourneyRepository } from '@/lib/repositories/comercialJourneyRepository'
import { supabaseServer } from '@/lib/supabaseServer'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' }
const ausente = () => NextResponse.json({ erro: 'Link inválido, expirado ou revogado. Solicite um novo link à equipe.' }, { status: 404, headers })
export async function POST(request: NextRequest) {
  if (!origemEhPermitida(request)) return NextResponse.json({ erro: 'Origem não autorizada.' }, { status: 403, headers })
  try {
    if (Number(request.headers.get('content-length') || 0) > 256) return ausente()
    const texto = await request.text()
    if (texto.length > 256) return ausente()
    let token: unknown
    try { token = JSON.parse(texto).token } catch { return ausente() }
    if (!tokenValido(token)) return ausente()
    const empresaId = empresaDoSite()
    const permitido = await comercialJourneyRepository.consumirLimitePublico(empresaId, hashToken(`acompanhamento:${hashDoSolicitante(request, empresaId)}`), 60, 900)
    if (!permitido) return NextResponse.json({ erro: 'Muitas consultas. Aguarde alguns minutos.' }, { status: 429, headers })
    const { data: link, error: erroLink } = await supabaseServer.from('acompanhamento_links')
      .select('oportunidade_id').eq('token_hash', hashToken(token)).is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
    if (erroLink) throw erroLink
    if (!link) return ausente()
    const { data: pedido, error: erroPedido } = await supabaseServer.from('oportunidades')
      .select('id,numero,etapa,data_evento,updated_at').eq('id', link.oportunidade_id).eq('empresa_id', empresaId).maybeSingle()
    if (erroPedido) throw erroPedido
    if (!pedido) return ausente()
    const { data: proposta, error: erroProposta } = await supabaseServer.from('orcamentos')
      .select('status,formalizacao_status,public_token,contrato_id,reserva_id')
      .eq('oportunidade_id', pedido.id).eq('empresa_id', empresaId).neq('status', 'RASCUNHO')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (erroProposta) throw erroProposta
    let contrato: { status: string; url: string | null } | null = null
    let reserva: Record<string, unknown> | null = null
    if (proposta?.reserva_id) {
      const resultado = await supabaseServer.from('reservas').select('id,status,status_operacional,status_pagamento,data_retirada,data_devolucao').eq('id', proposta.reserva_id).maybeSingle()
      if (resultado.error) throw resultado.error
      if (resultado.data) {
        const { id: _id, ...dados } = resultado.data
        reserva = dados
      }
    }
    if (proposta?.contrato_id && proposta?.reserva_id && ['CONTRATO_ENVIADO','AGUARDANDO_ASSINATURA','AGUARDANDO_PAGAMENTO','PRONTA_PARA_CONFIRMAR','RESERVA_CONFIRMADA'].includes(proposta.formalizacao_status)) {
      const resultado = await supabaseServer.from('contratos').select('status,public_token').eq('id', proposta.contrato_id).eq('reserva_id', proposta.reserva_id).maybeSingle()
      if (resultado.error) throw resultado.error
      if (resultado.data) contrato = { status: resultado.data.status, url: resultado.data.public_token ? `/contrato/${resultado.data.public_token}` : null }
    }
    return NextResponse.json({
      numero: pedido.numero, etapa: pedido.etapa, data_evento: pedido.data_evento,
      proposta: proposta ? { status: proposta.status, formalizacao: proposta.formalizacao_status, url: proposta.public_token && ['ENVIADA','ACEITA'].includes(proposta.status) ? `/proposta/${proposta.public_token}` : null } : null,
      contrato, reserva
    }, { headers })
  } catch {
    return NextResponse.json({ erro: 'Não foi possível consultar o pedido agora. Tente novamente.' }, { status: 503, headers })
  }
}
