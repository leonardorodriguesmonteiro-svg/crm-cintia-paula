import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  contexto: { params: Promise<{ id: string }> }
) {
  try {
    const acesso = await exigirPerfis(request, ['Comercial', 'Financeiro'])
    const { id } = await contexto.params

    const { data: contrato, error: contratoError } = await supabaseServer
      .from('contratos')
      .select('id,reserva_id,numero_contrato,status,email_enviado_em,email_destino')
      .eq('id', id)
      .maybeSingle()

    if (contratoError) throw contratoError
    if (!contrato) {
      return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
    }
    if (contrato.status === 'Assinado') {
      return NextResponse.json(
        { error: 'Um contrato assinado não pode ter o envio cancelado.' },
        { status: 409 }
      )
    }
    if (!contrato.email_enviado_em) {
      return NextResponse.json(
        { error: 'Este contrato ainda não possui um envio de e-mail ativo.' },
        { status: 400 }
      )
    }

    const { data: contratoAtualizado, error: updateError } = await supabaseServer
      .from('contratos')
      .update({
        public_token: randomUUID(),
        status: contrato.status === 'Enviado' ? 'Gerado' : contrato.status,
        email_enviado_em: null,
        email_destino: null,
        email_erro: null
      })
      .eq('id', contrato.id)
      .neq('status', 'Assinado')
      .select('id')
      .maybeSingle()

    if (updateError) throw updateError
    if (!contratoAtualizado) {
      return NextResponse.json(
        { error: 'O contrato foi assinado enquanto o cancelamento era processado e não foi alterado.' },
        { status: 409 }
      )
    }

    if (contrato.reserva_id) {
      await supabaseServer.from('reserva_timeline').insert({
        reserva_id: contrato.reserva_id,
        titulo: 'Envio do contrato cancelado',
        descricao: `O link enviado para ${contrato.email_destino || 'o cliente'} foi invalidado por ${acesso.vinculo.nome || 'usuário do ERP'}.`,
        tipo: 'Contrato'
      })
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Envio cancelado. O link anterior foi invalidado; após corrigir o contrato, faça um novo envio.'
    })
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}
