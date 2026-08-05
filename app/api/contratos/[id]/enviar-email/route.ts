import { NextRequest, NextResponse } from 'next/server'
import { EmailContratoNaoConfiguradoError, enviarContratoPorEmail } from '@/lib/contratoEmail'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const autorizacao = request.headers.get('authorization') || ''
  const token = autorizacao.startsWith('Bearer ') ? autorizacao.slice(7) : ''

  if (!token) return NextResponse.json({ error: 'Sessão não informada.' }, { status: 401 })

  const { data: usuario, error: usuarioError } = await supabaseServer.auth.getUser(token)
  if (usuarioError || !usuario.user) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })

  const { id } = await contexto.params

  try {
    const resultado = await enviarContratoPorEmail(id, request.nextUrl.origin)
    return NextResponse.json({ ...resultado, mensagem: `Contrato enviado para ${resultado.destino}.` })
  } catch (error) {
    const status = error instanceof EmailContratoNaoConfiguradoError ? 503 : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar o contrato.' }, { status })
  }
}
