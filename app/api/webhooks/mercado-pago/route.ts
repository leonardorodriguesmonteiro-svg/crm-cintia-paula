import { NextRequest, NextResponse } from 'next/server'
import { InvalidWebhookSignatureError } from 'mercadopago'
import {
  consultarPagamentoMercadoPago,
  MercadoPagoNaoConfiguradoError,
  validarWebhookMercadoPago
} from '@/lib/mercadoPago'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Notificacao = {
  id?: number | string
  type?: string
  action?: string
  data?: { id?: number | string }
}

function respostaOk(dados: Record<string, unknown> = {}) {
  return NextResponse.json({ recebido: true, ...dados })
}

export async function POST(request: NextRequest) {
  let notificacao: Notificacao = {}

  try {
    notificacao = await request.json()
  } catch {
    return NextResponse.json({ error: 'Notificação inválida.' }, { status: 400 })
  }

  const dataId = String(
    request.nextUrl.searchParams.get('data.id')
    || request.nextUrl.searchParams.get('id')
    || notificacao.data?.id
    || ''
  )
  const tipo = String(notificacao.type || request.nextUrl.searchParams.get('type') || '')
  const acao = String(notificacao.action || `${tipo}.updated`).slice(0, 120)
  const requestId = request.headers.get('x-request-id')

  if (!dataId) return NextResponse.json({ error: 'Pagamento não informado.' }, { status: 400 })

  try {
    validarWebhookMercadoPago({
      xSignature: request.headers.get('x-signature'),
      xRequestId: requestId,
      dataId
    })
  } catch (error) {
    if (error instanceof MercadoPagoNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    if (error instanceof InvalidWebhookSignatureError) {
      console.warn('[mercado-pago:webhook] assinatura rejeitada', {
        motivo: error.reason,
        possuiAssinatura: Boolean(request.headers.get('x-signature')),
        possuiRequestId: Boolean(requestId),
        possuiDataId: Boolean(dataId)
      })
      return NextResponse.json({ error: 'Assinatura do webhook inválida.' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Não foi possível validar o webhook.' }, { status: 401 })
  }

  if (tipo && tipo !== 'payment') return respostaOk({ ignorado: true })

  try {
    const pagamento = await consultarPagamentoMercadoPago(dataId)
    const pagamentoId = String(pagamento.id || dataId)
    const status = String(pagamento.status || 'unknown').toLowerCase()
    const externalReference = String(pagamento.external_reference || '')
    const correspondencia = externalReference.match(/^sinal:([0-9a-f-]{36})$/i)

    if (!correspondencia) return respostaOk({ ignorado: true })

    const lancamentoId = correspondencia[1]
    const { data: eventoExistente, error: consultaEventoError } = await supabaseServer
      .from('pagamento_webhook_eventos')
      .select('id,processado_em')
      .eq('provedor', 'Mercado Pago')
      .eq('pagamento_id', pagamentoId)
      .eq('acao', acao)
      .eq('status', status)
      .maybeSingle()

    if (consultaEventoError) throw consultaEventoError
    if (eventoExistente?.processado_em) return respostaOk({ duplicado: true })

    let eventoId = eventoExistente?.id || null

    if (!eventoId) {
      const { data: evento, error: eventoError } = await supabaseServer
        .from('pagamento_webhook_eventos')
        .insert({
          provedor: 'Mercado Pago',
          pagamento_id: pagamentoId,
          acao,
          status,
          request_id: requestId,
          external_reference: externalReference
        })
        .select('id')
        .single()

      if (eventoError?.code === '23505') {
        const { data: eventoConcorrente, error: eventoConcorrenteError } = await supabaseServer
          .from('pagamento_webhook_eventos')
          .select('id,processado_em')
          .eq('provedor', 'Mercado Pago')
          .eq('pagamento_id', pagamentoId)
          .eq('acao', acao)
          .eq('status', status)
          .single()

        if (eventoConcorrenteError) throw eventoConcorrenteError
        if (eventoConcorrente.processado_em) return respostaOk({ duplicado: true })
        eventoId = eventoConcorrente.id
      } else {
        if (eventoError) throw eventoError
        eventoId = evento.id
      }
    }

    const formaPagamento = `Mercado Pago · ${pagamento.payment_method_id || pagamento.payment_type_id || 'online'}`
    const { error: conciliacaoError } = await supabaseServer.rpc('conciliar_pagamento_mercado_pago', {
      p_lancamento_id: lancamentoId,
      p_pagamento_id: pagamentoId,
      p_status: status,
      p_status_detalhe: pagamento.status_detail || null,
      p_forma_pagamento: formaPagamento,
      p_valor: Number(pagamento.transaction_amount || 0),
      p_pago_em: pagamento.date_approved || null
    })

    if (conciliacaoError) throw conciliacaoError

    const { error: concluirEventoError } = await supabaseServer
      .from('pagamento_webhook_eventos')
      .update({ processado_em: new Date().toISOString(), erro: null })
      .eq('id', eventoId)

    if (concluirEventoError) throw concluirEventoError

    return respostaOk({ conciliado: status === 'approved' })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Falha ao processar a notificação.'

    await supabaseServer
      .from('pagamento_webhook_eventos')
      .update({ erro: mensagem.slice(0, 1000) })
      .eq('provedor', 'Mercado Pago')
      .eq('pagamento_id', dataId)
      .eq('acao', acao)

    return NextResponse.json({ error: 'Falha temporária ao conciliar o pagamento.' }, { status: 500 })
  }
}
