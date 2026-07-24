import { NextResponse } from 'next/server'
import { confirmarReserva } from '@/lib/domain/reserva.service'
import { supabaseServer } from '@/lib/supabaseServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authorization = request.headers.get('authorization')
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : ''

    if (!token) {
      return NextResponse.json(
        { sucesso: false, erro: 'Sessão não autenticada.' },
        { status: 401 }
      )
    }

    const { error: authError } = await supabaseServer.auth.getUser(token)

    if (authError) {
      return NextResponse.json(
        { sucesso: false, erro: 'Sessão inválida ou expirada.' },
        { status: 401 }
      )
    }

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
