import { NextRequest, NextResponse } from 'next/server'
import { obterMissao } from '@/lib/application/mission/missionApplication'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { vinculo } = await exigirPerfis(request, ['Operação', 'Estoque'])
    const { id } = await params
    const missao = await obterMissao(id, vinculo.empresa_id)

    return NextResponse.json({
      sucesso: true,
      missao
    })
  } catch (error: unknown) {
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      {
        sucesso: false,
        erro: falha.mensagem || 'Erro ao carregar missão.'
      },
      { status: falha.status === 400 ? 404 : falha.status }
    )
  }
}
