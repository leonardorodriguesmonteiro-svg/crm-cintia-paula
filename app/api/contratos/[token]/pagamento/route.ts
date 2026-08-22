import { NextRequest, NextResponse } from 'next/server'
import { publicarConfirmacaoReservaV2 } from '@/lib/formalizacaoConfirmacao'
import {
  buscarPagamentoMercadoPagoPorReferencia,
  conciliarPagamentoMercadoPago,
  consultarPagamentoMercadoPago,
  MercadoPagoNaoConfiguradoError
} from '@/lib/mercadoPago'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Contexto = {
  params: Promise<{ token: string }>
}

const tokenValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, contexto: Contexto) {
  const { token } = await contexto.params

  if (!tokenValido.test(token)) {
    return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  }

  let corpo: { payment_id?: string } = {}

  try {
    corpo = await request.json()
  } catch {
    // O identificador é opcional: sem ele, buscamos pela referência externa.
  }

  try {
    const { data: contrato, error: contratoError } = await supabaseServer
      .from('contratos')
      .select('id')
      .eq('public_token', token)
      .maybeSingle()

    if (contratoError) throw contratoError
    if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })

    const { data: orcamento, error: orcamentoError } = await supabaseServer
      .from('orcamentos')
      .select('lancamento_sinal_id')
      .eq('contrato_id', contrato.id)
      .maybeSingle()

    if (orcamentoError) throw orcamentoError
    if (!orcamento?.lancamento_sinal_id) {
      return NextResponse.json({ error: 'Cobrança do sinal não encontrada.' }, { status: 404 })
    }

    const lancamentoId = orcamento.lancamento_sinal_id
    const { data: lancamento, error: lancamentoError } = await supabaseServer
      .from('lancamentos_financeiros')
      .select('status,provedor_pagamento_id,status_provedor')
      .eq('id', lancamentoId)
      .maybeSingle()

    if (lancamentoError) throw lancamentoError
    if (!lancamento) return NextResponse.json({ error: 'Cobrança do sinal não encontrada.' }, { status: 404 })

    if (lancamento.status === 'Pago') {
      return NextResponse.json({
        sucesso: true,
        conciliado: true,
        status: lancamento.status_provedor || 'approved',
        pagamento_id: lancamento.provedor_pagamento_id
      })
    }

    const paymentId = String(corpo.payment_id || '').replace(/\D/g, '').slice(0, 40)
    const referencia = `sinal:${lancamentoId}`
    const pagamento = paymentId
      ? await consultarPagamentoMercadoPago(paymentId)
      : await buscarPagamentoMercadoPagoPorReferencia(referencia)

    if (!pagamento) {
      return NextResponse.json({
        sucesso: true,
        conciliado: false,
        status: 'not_found'
      })
    }

    const resultado = await conciliarPagamentoMercadoPago(lancamentoId, pagamento)
    const evento = await publicarConfirmacaoReservaV2(
      resultado,
      'Mercado Pago · consulta do contrato'
    )

    return NextResponse.json({
      sucesso: true,
      ...resultado,
      avisos: evento.avisos
    })
  } catch (error) {
    if (error instanceof MercadoPagoNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível confirmar o pagamento.' },
      { status: 502 }
    )
  }
}
