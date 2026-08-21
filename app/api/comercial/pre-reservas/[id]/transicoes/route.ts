import { NextRequest, NextResponse } from 'next/server'
import {
  JornadaComercialError,
  transicionarPreReserva
} from '@/lib/application/comercial/jornadaComercialApplication'
import { statusPreReserva, type StatusPreReserva } from '@/lib/domain/comercial/jornadaComercial'
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
    const corpo = await request.json().catch(() => ({})) as Record<string, unknown>
    const proximoStatus = String(corpo.proximo_status || '') as StatusPreReserva
    const versaoEsperada = Number(corpo.versao)

    if (!statusPreReserva.includes(proximoStatus)) {
      return NextResponse.json(
        { sucesso: false, erro: 'Estado comercial inválido.' },
        { status: 400 }
      )
    }
    if (!Number.isInteger(versaoEsperada) || versaoEsperada < 1) {
      return NextResponse.json(
        { sucesso: false, erro: 'Versão da pré-reserva inválida.' },
        { status: 400 }
      )
    }

    const resultado = await transicionarPreReserva({
      empresaId: vinculo.empresa_id,
      oportunidadeId: id,
      usuarioId: usuario.id,
      versaoEsperada,
      proximoStatus,
      observacao: typeof corpo.observacao === 'string' ? corpo.observacao : null
    })

    return NextResponse.json({ sucesso: true, pre_reserva: resultado })
  } catch (error) {
    if (error instanceof JornadaComercialError) {
      return NextResponse.json(
        { sucesso: false, erro: error.message, codigo: error.codigo },
        { status: error.statusHttp }
      )
    }
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}
