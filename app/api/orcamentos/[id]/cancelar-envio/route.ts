import { NextRequest, NextResponse } from 'next/server'
import { cancelarEnvioProposta } from '@/lib/application/comercial/jornadaComercialApplication'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  contexto: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Comercial'])
    const { id } = await contexto.params
    const resultado = await cancelarEnvioProposta({
      usuarioId: usuario.id,
      empresaId: vinculo.empresa_id,
      orcamentoId: id
    })
    return NextResponse.json({
      sucesso: true,
      mensagem: 'Envio cancelado. O link anterior foi invalidado e a proposta voltou para rascunho.',
      proposta: resultado
    })
  } catch (error) {
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json({ error: falha.mensagem }, { status: falha.status })
  }
}
