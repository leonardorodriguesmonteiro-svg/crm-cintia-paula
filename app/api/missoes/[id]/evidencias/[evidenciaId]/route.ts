import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; evidenciaId: string }> }
) {
  try {
    const { vinculo } = await exigirPerfis(request, ['Operação', 'Estoque'])
    const { id: missaoId, evidenciaId } = await params

    const { data: evidencia, error: buscaError } = await supabaseServer
      .from('evidencias_missao')
      .select('id,storage_path')
      .eq('id', evidenciaId)
      .eq('ordem_servico_id', missaoId)
      .eq('empresa_id', vinculo.empresa_id)
      .maybeSingle()

    if (buscaError) throw buscaError
    if (!evidencia) throw new Error('Evidência não encontrada.')

    const { error: removerArquivoError } = await supabaseServer.storage
      .from('evidencias-missao')
      .remove([evidencia.storage_path])

    if (removerArquivoError) throw removerArquivoError

    const { error: removerRegistroError } = await supabaseServer
      .from('evidencias_missao')
      .delete()
      .eq('id', evidencia.id)

    if (removerRegistroError) throw removerRegistroError

    return NextResponse.json({ sucesso: true })
  } catch (error: unknown) {
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}
