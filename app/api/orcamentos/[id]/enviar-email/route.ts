import { NextRequest, NextResponse } from 'next/server'
import { enviarProposta } from '@/lib/application/comercial/jornadaComercialApplication'
import { EmailPropostaNaoConfiguradoError, enviarPropostaPorEmail } from '@/lib/propostaEmail'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
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
      .select('id,status,empresa_id')
      .eq('id', id)
      .eq('empresa_id', acesso.vinculo.empresa_id)
      .maybeSingle()

    if (error) throw error
    if (!orcamento) return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })

    if (orcamento.status === 'RASCUNHO') {
      await enviarProposta({
        usuarioId: acesso.usuario.id,
        empresaId: acesso.vinculo.empresa_id,
        orcamentoId: id
      })
    } else if (orcamento.status !== 'ENVIADA') {
      return NextResponse.json(
        { error: 'A proposta respondida ou encerrada não pode ser enviada novamente.' },
        { status: 409 }
      )
    }

    const resultado = await enviarPropostaPorEmail(id, request.nextUrl.origin, {
      reenviar: corpo?.reenviar === true
    })
    return NextResponse.json({
      ...resultado,
      mensagem: resultado.ignorado
        ? `A proposta já havia sido enviada para ${resultado.destino}.`
        : `Proposta enviada para ${resultado.destino}.`
    })
  } catch (error) {
    if (error instanceof EmailPropostaNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json({ error: falha.mensagem }, { status: falha.status })
  }
}
