import { NextRequest, NextResponse } from 'next/server'
import { hashToken, tokenValido } from '@/lib/server/acompanhamento'
import { empresaDoSite, hashDoSolicitante, origemEhPermitida } from '@/lib/server/publicPreReservation'
import { comercialJourneyRepository } from '@/lib/repositories/comercialJourneyRepository'
import { validarCadastroCliente, type CompletarDadosClientePropostaV2Input } from '@/lib/application/comercial/dadosClientePropostaApplication'
import { JornadaComercialError } from '@/lib/application/comercial/jornadaComercialApplication'
import { supabaseServer } from '@/lib/supabaseServer'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' }
export async function POST(request: NextRequest) {
  if (!origemEhPermitida(request)) return NextResponse.json({ erro: 'Origem não autorizada.' }, { status: 403, headers })
  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) return NextResponse.json({ erro: 'Dados muito longos.' }, { status: 413, headers })
    const texto = await request.text()
    if (texto.length > 4096) return NextResponse.json({ erro: 'Dados muito longos.' }, { status: 413, headers })
    const corpo = JSON.parse(texto)
    if (!corpo || !tokenValido(corpo.token)) return NextResponse.json({ erro: 'Link inválido.' }, { status: 400, headers })
    const empresaId = empresaDoSite()
    const permitido = await comercialJourneyRepository.consumirLimitePublico(empresaId, hashToken(`cadastro:${hashDoSolicitante(request, empresaId)}`), 10, 900)
    if (!permitido) return NextResponse.json({ erro: 'Aguarde alguns minutos antes de tentar novamente.' }, { status: 429, headers })
    const campos = ['cpf','cep','endereco','numero','complemento','bairro','cidade','estado','email'] as const
    const entrada = { token: corpo.token } as CompletarDadosClientePropostaV2Input
    for (const campo of campos) entrada[campo] = typeof corpo[campo] === 'string' ? corpo[campo] : ''
    const dados = validarCadastroCliente(entrada)
    const { data, error } = await supabaseServer.rpc('completar_cadastro_pre_reserva', { p_empresa_id: empresaId, p_token_hash: hashToken(corpo.token), p_dados: dados })
    if (error) return NextResponse.json({ erro: error.code === '22023' ? error.message : 'Não foi possível salvar o cadastro. Tente novamente.' }, { status: error.code === '22023' ? 409 : 503, headers })
    return NextResponse.json(data, { headers })
  } catch (error) {
    return NextResponse.json({ erro: error instanceof JornadaComercialError ? error.message : 'Confira os dados e tente novamente.' }, { status: 400, headers })
  }
}
