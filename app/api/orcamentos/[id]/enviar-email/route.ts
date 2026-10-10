import { NextRequest, NextResponse } from 'next/server'
import { executarEnvioPropostaEmail } from '@/lib/application/comercial/envioPropostaEmail'
import { enviarProposta } from '@/lib/application/comercial/jornadaComercialApplication'
import { EmailPropostaNaoConfiguradoError, enviarPropostaPorEmail, prepararEmailProposta } from '@/lib/propostaEmail'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { origemPublicaJornada } from '@/lib/origemPublicaJornada'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  contexto: { params: Promise<{ id: string }> }
) {
  try {
    const acesso = await exigirPerfis(request, ['Comercial'])
    const { id } = await contexto.params
    const corpo = await request.json().catch(() => ({}))
    const { data: orcamento, error } = await supabaseServer
      .from('orcamentos')
      .select('id,status,empresa_id,oportunidade_id')
      .eq('id', id)
      .eq('empresa_id', acesso.vinculo.empresa_id)
      .maybeSingle()

    if (error) throw error
    if (!orcamento) return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })

    if (!['RASCUNHO', 'FINALIZADO', 'ENVIADA'].includes(orcamento.status)) {
      return NextResponse.json({ error: 'Finalize o orçamento antes de enviar. Propostas encerradas não podem ser reenviadas.' }, { status: 409 })
    }
    if (orcamento.status === 'RASCUNHO' && orcamento.oportunidade_id) {
      const { data: pedido, error: erroPedido } = await supabaseServer.from('oportunidades')
        .select('cadastro_completo_em').eq('id', orcamento.oportunidade_id)
        .eq('empresa_id', acesso.vinculo.empresa_id).maybeSingle()
      if (erroPedido) throw erroPedido
      if (!pedido?.cadastro_completo_em) return NextResponse.json({ error: 'Aguarde o cliente completar os dados necessários ao contrato.' }, { status: 409 })
    }
    const resultado = await executarEnvioPropostaEmail({
      preparar: () => prepararEmailProposta(id),
      disponibilizar: () => enviarProposta({ usuarioId: acesso.usuario.id, empresaId: acesso.vinculo.empresa_id, orcamentoId: id }),
      enviar: () => enviarPropostaPorEmail(id, origemPublicaJornada(request.nextUrl.origin), { reenviar: corpo?.reenviar === true })
    })
    return NextResponse.json({
      ...resultado,
      mensagem: resultado.ignorado
        ? `A proposta já havia sido enviada para ${resultado.destino}.`
        : `Envio do orçamento para ${resultado.destino} aceito pelo serviço de e-mail. A entrega ainda não está confirmada.`
    })
  } catch (error) {
    if (error instanceof EmailPropostaNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json({ error: falha.mensagem }, { status: falha.status })
  }
}
