import { NextRequest, NextResponse } from 'next/server'
import {
  criarPreReserva,
  JornadaComercialError
} from '@/lib/application/comercial/jornadaComercialApplication'
import type { ItemPreReservaInput } from '@/lib/application/comercial/jornadaComercial.types'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function itensDoCorpo(valor: unknown): ItemPreReservaInput[] {
  if (!Array.isArray(valor)) return []

  return valor.map(item => {
    const registro = item && typeof item === 'object'
      ? item as Record<string, unknown>
      : {}
    const base = {
      quantidade: Number(registro.quantidade),
      observacoes: typeof registro.observacoes === 'string'
        ? registro.observacoes
        : null
    }

    return registro.tipo === 'KIT'
      ? { ...base, tipo: 'KIT' as const, kitId: String(registro.id || '') }
      : {
          ...base,
          tipo: 'ITEM_ESTOQUE' as const,
          estoqueItemId: String(registro.id || '')
        }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Comercial'])
    const corpo = await request.json().catch(() => ({})) as Record<string, unknown>
    const preReserva = await criarPreReserva({
      empresaId: vinculo.empresa_id,
      usuarioId: usuario.id,
      clienteId: typeof corpo.cliente_id === 'string' ? corpo.cliente_id : null,
      nomeContato: String(corpo.nome || ''),
      celular: String(corpo.celular || ''),
      email: typeof corpo.email === 'string' ? corpo.email : null,
      origem: 'ERP',
      origemExternaId: typeof corpo.idempotencia === 'string'
        ? `erp:${corpo.idempotencia}`
        : null,
      dataEvento: typeof corpo.data_evento === 'string' ? corpo.data_evento : null,
      interesse: typeof corpo.interesse === 'string' ? corpo.interesse : null,
      itens: itensDoCorpo(corpo.itens)
    })

    return NextResponse.json(
      { sucesso: true, pre_reserva: preReserva },
      { status: preReserva.criada ? 201 : 200 }
    )
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
