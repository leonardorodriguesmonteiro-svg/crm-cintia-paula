import { NextRequest, NextResponse } from 'next/server'
import {
  Orcamento3Error
} from '@/lib/application/comercial/orcamento3Application'
import { salvarOrcamento3 } from '@/lib/application/comercial/orcamento3Service'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { orcamento3DoCorpo } from '@/lib/server/orcamento3Request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(
  request: NextRequest,
  contexto: { params: Promise<{ id: string }> }
) {
  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Comercial'])
    const { id } = await contexto.params
    const corpo = await request.json().catch(() => ({})) as Record<string, unknown>
    const resultado = await salvarOrcamento3(orcamento3DoCorpo(corpo, {
      empresaId: vinculo.empresa_id,
      usuarioId: usuario.id,
      orcamentoId: id
    }))

    return NextResponse.json({ sucesso: true, orcamento: resultado })
  } catch (error) {
    if (error instanceof Orcamento3Error) {
      return NextResponse.json(
        { sucesso: false, erro: error.message, codigo: error.codigo },
        { status: error.statusHttp }
      )
    }
    console.error('[api/orcamentos/:id] falha inesperada', error)
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}

export const PATCH = PUT
