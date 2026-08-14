import { NextRequest, NextResponse } from 'next/server'
import { confirmarReserva } from '@/lib/domain/reserva.service'
import { enviarContratoPorEmail } from '@/lib/contratoEmail'
import { contratoRepository } from '@/lib/repositories/contratoRepository'
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
    const contrato = await contratoRepository.buscarPorReserva(id)
    let email: {
      enviado: boolean
      destino?: string | null
      ignorado?: boolean
      erro?: string
    }

    if (!contrato) {
      email = {
        enviado: false,
        erro: 'O contrato não foi encontrado após a confirmação da reserva.'
      }
    } else {
      try {
        const resultadoEmail = await enviarContratoPorEmail(
          contrato.id,
          request.nextUrl.origin
        )

        email = {
          enviado: true,
          destino: resultadoEmail.destino,
          ignorado: resultadoEmail.ignorado
        }
      } catch (error) {
        email = {
          enviado: false,
          erro: error instanceof Error
            ? error.message
            : 'Não foi possível enviar o e-mail do contrato.'
        }
      }
    }

    return NextResponse.json({
      sucesso: true,
      reserva,
      contrato_id: contrato?.id || null,
      email
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
