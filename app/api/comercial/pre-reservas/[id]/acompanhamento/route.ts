import { consultarEnvios, enviarAcompanhamento } from '@/lib/server/acompanhamentoEnvios'
import { NextRequest, NextResponse } from 'next/server'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { gerarLink } from '@/lib/server/acompanhamento'
import { supabaseServer } from '@/lib/supabaseServer'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
async function executar(request: NextRequest, contexto: { params: Promise<{ id: string }> }, revogar: boolean) {
  try {
    const { vinculo } = await exigirPerfis(request, ['Comercial'])
    const { id } = await contexto.params
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400, headers })
    if (!revogar) {
      const corpo = await request.json().catch(() => ({}))
      const url = await gerarLink(id, vinculo.empresa_id, corpo.acao === 'substituir')
      const { data: pedido } = await supabaseServer.from('oportunidades').select('etapa').eq('id', id).eq('empresa_id', vinculo.empresa_id).single()
      const finalidade = ['APROVADA', 'CONVERTIDA_EM_PROPOSTA'].includes(pedido?.etapa) ? 'aprovacao' : 'recebimento'
      const envios = corpo.acao === 'enviar_email' || corpo.acao === 'enviar_whatsapp'
        ? await enviarAcompanhamento(id, vinculo.empresa_id, [corpo.acao === 'enviar_email' ? 'email' : 'whatsapp'], finalidade)
        : await consultarEnvios(id, finalidade)
      return NextResponse.json({ url, envios, whatsapp_disponivel: finalidade === 'recebimento' && Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME && process.env.WHATSAPP_GRAPH_VERSION) }, { headers })
    }
    const { data, error } = await supabaseServer.from('oportunidades').select('id').eq('id', id).eq('empresa_id', vinculo.empresa_id).maybeSingle()
    if (error || !data) return NextResponse.json({ erro: 'Pedido não encontrado.' }, { status: 404, headers })
    const resultado = await supabaseServer.from('acompanhamento_links').update({ revoked_at: new Date().toISOString() }).eq('oportunidade_id', id)
    if (resultado.error) throw new Error('Não foi possível revogar o link.')
    return NextResponse.json({ sucesso: true }, { headers })
  } catch (error) {
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json({ erro: falha.mensagem }, { status: falha.status, headers })
  }
}
export const POST = (r: NextRequest, c: { params: Promise<{ id: string }> }) => executar(r, c, false)
export const DELETE = (r: NextRequest, c: { params: Promise<{ id: string }> }) => executar(r, c, true)
