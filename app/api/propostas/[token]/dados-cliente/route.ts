import { NextRequest, NextResponse } from 'next/server'
import { completarDadosClientePropostaV2 } from '@/lib/application/comercial/dadosClientePropostaApplication'
import { JornadaComercialError } from '@/lib/application/comercial/jornadaComercialApplication'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const tokenValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  contexto: { params: Promise<{ token: string }> }
) {
  const { token } = await contexto.params
  if (!tokenValido.test(token)) {
    return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
  }

  try {
    const corpo = await request.json().catch(() => ({})) as Record<string, unknown>
    const resultado = await completarDadosClientePropostaV2({
      token,
      cpf: String(corpo.cpf || ''),
      cep: String(corpo.cep || ''),
      endereco: String(corpo.endereco || ''),
      numero: String(corpo.numero || ''),
      complemento: typeof corpo.complemento === 'string' ? corpo.complemento : null,
      bairro: String(corpo.bairro || ''),
      cidade: String(corpo.cidade || ''),
      estado: String(corpo.estado || ''),
      email: typeof corpo.email === 'string' ? corpo.email : null
    })

    return NextResponse.json({
      sucesso: true,
      mensagem: resultado.ja_completo
        ? 'Seus dados já estavam completos.'
        : 'Dados salvos. A equipe já pode preparar seu contrato.',
      formalizacao_status: resultado.status
    })
  } catch (error) {
    if (error instanceof JornadaComercialError) {
      return NextResponse.json({ error: error.message }, { status: error.statusHttp })
    }
    const mensagem = error instanceof Error ? error.message : ''
    return NextResponse.json(
      { error: mensagem.includes('aceita') ? 'A proposta precisa estar aceita.' : 'Não foi possível salvar seus dados.' },
      { status: mensagem.includes('aceita') ? 409 : 400 }
    )
  }
}
