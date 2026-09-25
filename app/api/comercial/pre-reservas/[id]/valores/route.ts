import { NextRequest, NextResponse } from 'next/server'
import {
  ajustarValoresPreReserva,
  JornadaComercialError
} from '@/lib/application/comercial/jornadaComercialApplication'
import type { TipoDescontoPreReserva } from '@/lib/domain/comercial/jornadaComercial'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: NextRequest,
  contexto: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Comercial'])
    const { id } = await contexto.params
    const corpo = await request.json().catch(() => ({})) as Record<string, unknown>

    const resultado = await ajustarValoresPreReserva({
      empresaId: vinculo.empresa_id,
      oportunidadeId: id,
      usuarioId: usuario.id,
      versaoEsperada: Number(corpo.versao),
      descontoTipo: String(corpo.desconto_tipo || '') as TipoDescontoPreReserva,
      descontoValor: Number(corpo.desconto_valor)
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
