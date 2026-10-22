import { NextRequest, NextResponse } from 'next/server'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { supabaseServer } from '@/lib/supabaseServer'
import { avisarCancelamentoContrato } from '@/lib/contratoCancelamentoEmail'

export async function POST(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  try {
    const acesso = await exigirPerfis(request, ['Comercial'])
    const { id } = await contexto.params
    const { data: contrato } = await supabaseServer.from('contratos').select('reserva_id').eq('id', id).maybeSingle()
    const { data: proposta } = await supabaseServer.from('orcamentos').select('id').eq('reserva_id', contrato?.reserva_id || '00000000-0000-0000-0000-000000000000').eq('empresa_id', acesso.vinculo.empresa_id).maybeSingle()
    if (!proposta) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    const aviso = await avisarCancelamentoContrato(id)
    return NextResponse.json({ mensagem: aviso.enviado ? 'Aviso de cancelamento enviado.' : 'Aviso pendente. Aguarde dois minutos antes de tentar novamente.' }, { status: aviso.enviado ? 200 : 503 })
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}
