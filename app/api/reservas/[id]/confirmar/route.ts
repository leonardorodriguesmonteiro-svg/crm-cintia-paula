import { NextResponse } from 'next/server'
import { confirmarReserva } from '@/lib/domain/reserva.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const reserva = await confirmarReserva(id)

    return NextResponse.json({
      sucesso: true,
      reserva
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: error?.message || 'Erro ao confirmar reserva.'
      },
      { status: 500 }
    )
  }
}
