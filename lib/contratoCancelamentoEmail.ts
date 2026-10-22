import { supabaseServer } from '@/lib/supabaseServer'

export async function avisarCancelamentoContrato(id: string) {
  const { data: contrato, error } = await supabaseServer.from('contratos')
    .select('id,numero_contrato,status,cancelado_em,notificacao_cancelamento_em,snapshot_contratual').eq('id', id).single()
  if (error) throw error
  if (contrato.status !== 'Cancelado' || !contrato.cancelado_em) throw new Error('Este contrato não foi substituído por uma revisão.')
  if (contrato.notificacao_cancelamento_em) return { enviado: true }
  const email = String(contrato.snapshot_contratual?.cliente?.email || '').trim().toLowerCase()
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_REMETENTE
  try {
    if (!apiKey || !from) throw new Error('Envio de e-mail não configurado.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Cliente sem e-mail válido.')
    const { data: claim, error: claimError } = await supabaseServer.from('contratos')
      .update({ notificacao_cancelamento_inicio: new Date().toISOString() })
      .eq('id', id).is('notificacao_cancelamento_em', null)
      .or(`notificacao_cancelamento_inicio.is.null,notificacao_cancelamento_inicio.lt.${new Date(Date.now()-120000).toISOString()}`)
      .select('id').maybeSingle()
    if (claimError) throw claimError
    if (!claim) return { enviado: false }
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `cancelamento-contrato-${id}` },
      body: JSON.stringify({ from, to: [email], ...(process.env.EMAIL_RESPOSTA ? { reply_to: process.env.EMAIL_RESPOSTA } : {}),
        subject: `Contrato ${contrato.numero_contrato} cancelado para revisão`,
        text: `Olá! A versão ${contrato.numero_contrato} do contrato foi cancelada devido a alterações na reserva. Desconsidere o link anterior: ele não permite mais assinatura. A equipe Cintia Paula enviará um novo contrato para sua conferência e assinatura após concluir a revisão. Os pagamentos já registrados permanecem preservados. Em caso de dúvida, responda a este e-mail.\n\nEquipe Cintia Paula Festas e Decorações`
      })
    })
    if (!resposta.ok) throw new Error('O provedor não confirmou o envio. Tente novamente pelo painel de contratos.')
    const { error: registroError } = await supabaseServer.from('contratos').update({ notificacao_cancelamento_em: new Date().toISOString(), notificacao_cancelamento_erro: null }).eq('id', id)
    if (registroError) throw registroError
    return { enviado: true }
  } catch {
    await supabaseServer.from('contratos').update({ notificacao_cancelamento_erro: 'Aviso pendente. Confira o e-mail do cliente e tente novamente.' }).eq('id', id)
    return { enviado: false }
  }
}
