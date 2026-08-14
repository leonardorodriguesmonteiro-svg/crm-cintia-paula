import { NextRequest, NextResponse } from 'next/server'
import { EmailContratoNaoConfiguradoError, enviarContratoPorEmail } from '@/lib/contratoEmail'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  try {
    await exigirPerfis(request, ['Comercial', 'Financeiro'])
    const { id } = await contexto.params
    const corpo = await request.json().catch(() => ({}))
    const resultado = await enviarContratoPorEmail(id, request.nextUrl.origin, {
      reenviar: corpo?.reenviar === true
    })
    const mensagem = resultado.ignorado
      ? `O contrato já havia sido enviado para ${resultado.destino || 'o cliente'}.`
      : `Contrato enviado para ${resultado.destino}.`

    return NextResponse.json({ ...resultado, mensagem })
  } catch (error) {
    if (error instanceof EmailContratoNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}
