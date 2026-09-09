import { NextRequest, NextResponse } from 'next/server'
import { criarOuObterPreferenciaMercadoPago, MercadoPagoNaoConfiguradoError } from '@/lib/mercadoPago'
import { supabaseServer } from '@/lib/supabaseServer'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    await exigirPerfis(request, ['Comercial', 'Financeiro'])
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }

  let corpo: { orcamento_id?: string; forcar?: boolean }

  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 })
  }

  const orcamentoId = String(corpo.orcamento_id || '')
  if (!/^[0-9a-f-]{36}$/i.test(orcamentoId)) {
    return NextResponse.json({ error: 'Orçamento inválido.' }, { status: 400 })
  }

  const { data: orcamento, error } = await supabaseServer
    .from('orcamentos')
    .select('lancamento_sinal_id,status')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Não foi possível consultar o orçamento.' }, { status: 500 })
  if (!orcamento?.lancamento_sinal_id || orcamento.status !== 'ACEITA') {
    return NextResponse.json({ error: 'Formalize a venda antes de gerar a cobrança.' }, { status: 400 })
  }

  try {
    const preferencia = await criarOuObterPreferenciaMercadoPago(
      orcamento.lancamento_sinal_id,
      request.nextUrl.origin,
      { forcar: Boolean(corpo.forcar) }
    )

    return NextResponse.json({
      sucesso: true,
      mensagem: preferencia.criado ? 'Cobrança criada no Mercado Pago.' : 'Cobrança do Mercado Pago já disponível.',
      preferencia
    })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Não foi possível criar a cobrança.'
    return NextResponse.json(
      { error: mensagem },
      { status: error instanceof MercadoPagoNaoConfiguradoError ? 503 : 400 }
    )
  }
}
