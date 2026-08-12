import { NextRequest, NextResponse } from 'next/server'
import { confirmarReserva } from '@/lib/domain/reserva.service'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await exigirPerfis(request, ['Comercial'])

    const { id } = await params
    const reserva = await confirmarReserva(id)

    return NextResponse.json({
      sucesso: true,
      reserva
    })
  } catch (error: any) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json(
      {
        sucesso: false,
        erro: resposta.mensagem || 'Erro ao confirmar reserva.'
      },
      { status: resposta.status }
    )
  }
}
