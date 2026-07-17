import { NextResponse } from 'next/server'
import { obterMissao } from '@/lib/application/mission/missionApplication'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const missao = await obterMissao(id)

    return NextResponse.json({
      sucesso: true,
      missao
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: error?.message || 'Erro ao carregar missão.'
      },
      { status: 404 }
    )
  }
}
