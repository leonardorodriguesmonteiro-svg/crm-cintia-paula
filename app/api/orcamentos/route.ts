import { NextRequest, NextResponse } from 'next/server'
import {
  Orcamento3Error
} from '@/lib/application/comercial/orcamento3Application'
import { salvarOrcamento3 } from '@/lib/application/comercial/orcamento3Service'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { orcamento3DoCorpo } from '@/lib/server/orcamento3Request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Comercial'])
    const corpo = await request.json().catch(() => ({})) as Record<string, unknown>
    const resultado = await salvarOrcamento3(orcamento3DoCorpo(corpo, {
      empresaId: vinculo.empresa_id,
      usuarioId: usuario.id,
      idempotenciaCabecalho: request.headers.get('idempotency-key')
    }))

    return NextResponse.json(
      { sucesso: true, orcamento: resultado },
      { status: resultado.criado ? 201 : 200 }
    )
  } catch (error) {
    if (error instanceof Orcamento3Error) {
      return NextResponse.json(
        { sucesso: false, erro: error.message, codigo: error.codigo },
        { status: error.statusHttp }
      )
    }
    const falha = respostaErroAdministrativo(error)
    if (falha.status >= 500) {
      console.error('[api/orcamentos] falha inesperada', error)
    }
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}
