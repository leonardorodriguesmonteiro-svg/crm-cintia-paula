import { NextRequest, NextResponse } from 'next/server'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { supabaseServer } from '@/lib/supabaseServer'
import { avisarCancelamentoContrato } from '@/lib/contratoCancelamentoEmail'

export async function POST(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  try {
    const acesso = await exigirPerfis(request, ['Comercial'])
    const { id } = await contexto.params
    const texto = await request.text()
    if (texto.length > 100000) return NextResponse.json({ error: 'Reserva excede o tamanho permitido.' }, { status: 400 })
    let dados
    try { dados = JSON.parse(texto) } catch { return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 }) }
    if (!dados || !Number.isInteger(dados.revisao)) return NextResponse.json({ error: 'Atualize a reserva antes de salvar.' }, { status: 400 })
    const { data, error } = await supabaseServer.rpc('revisar_reserva_servidor', {
      p_empresa_id: acesso.vinculo.empresa_id, p_usuario_id: acesso.usuario.id, p_reserva_id: id, p_dados: dados
    })
    if (error) return NextResponse.json({ error: error.message }, { status: error.code === '40001' ? 409 : error.code === '42501' ? 403 : 400 })
    let aviso: { enviado: boolean } | null = null
    if (data.contrato_cancelado_id) {
      try { aviso = await avisarCancelamentoContrato(data.contrato_cancelado_id) }
      catch { aviso = { enviado: false } }
    }
    return NextResponse.json({ ...data, aviso, mensagem: !data.alterado ? 'Dados salvos.' : aviso ? aviso.enviado
      ? 'Reserva, orçamento e solicitação atualizados. Contrato anterior cancelado e aviso enviado por e-mail. Libere a nova versão em Contrato e sinal.'
      : 'Alterações salvas e contrato anterior cancelado. O aviso por e-mail está pendente; tente novamente em Contratos.'
      : 'Reserva, orçamento e solicitação atualizados.' })
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}
