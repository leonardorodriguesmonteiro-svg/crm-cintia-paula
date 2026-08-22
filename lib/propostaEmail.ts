import { supabaseServer } from '@/lib/supabaseServer'

export class EmailPropostaNaoConfiguradoError extends Error {
  constructor() {
    super('Configure RESEND_API_KEY e EMAIL_REMETENTE na Vercel para enviar propostas.')
    this.name = 'EmailPropostaNaoConfiguradoError'
  }
}

function escaparHtml(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function emailValido(valor: string | null | undefined) {
  const email = String(valor || '').trim().toLowerCase()
  return email.length > 0
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function enviarPropostaPorEmail(
  orcamentoId: string,
  origem: string,
  opcoes: { reenviar?: boolean } = {}
) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const remetente = String(process.env.EMAIL_REMETENTE || '').trim()
  const respostaPara = String(process.env.EMAIL_RESPOSTA || '').trim()

  const { data: orcamento, error } = await supabaseServer
    .from('orcamentos')
    .select('id,numero,public_token,status,cliente_id,oportunidade_id,email_enviado_em,email_destino,total,data_evento')
    .eq('id', orcamentoId)
    .maybeSingle()

  if (error) throw error
  if (!orcamento?.public_token) throw new Error('Proposta não encontrada ou sem link público.')
  if (orcamento.email_enviado_em && !opcoes.reenviar) {
    return { sucesso: true, destino: orcamento.email_destino, ignorado: true }
  }
  if (!apiKey || !remetente) throw new EmailPropostaNaoConfiguradoError()

  let cliente: { nome: string; email: string | null } | null = null
  if (orcamento.cliente_id) {
    const resposta = await supabaseServer
      .from('clientes')
      .select('nome,email')
      .eq('id', orcamento.cliente_id)
      .maybeSingle()
    if (resposta.error) throw resposta.error
    cliente = resposta.data
  }
  if ((!cliente?.email || !cliente.nome) && orcamento.oportunidade_id) {
    const resposta = await supabaseServer
      .from('oportunidades')
      .select('nome_contato,email')
      .eq('id', orcamento.oportunidade_id)
      .maybeSingle()
    if (resposta.error) throw resposta.error
    if (resposta.data) cliente = {
      nome: resposta.data.nome_contato,
      email: resposta.data.email
    }
  }

  if (!emailValido(cliente?.email)) {
    throw new Error('Cadastre um e-mail válido do cliente antes de enviar a proposta.')
  }

  const emailDestino = String(cliente!.email).trim().toLowerCase()
  const link = `${new URL(origem).origin}/proposta/${orcamento.public_token}`
  const numero = `ORC-${String(orcamento.numero).padStart(4, '0')}`
  const nome = escaparHtml(cliente?.nome || 'cliente')
  const total = Number(orcamento.total || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  })

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: remetente,
      to: [emailDestino],
      ...(respostaPara ? { reply_to: respostaPara } : {}),
      subject: `Sua proposta ${numero} — Cintia Paula`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937;line-height:1.6"><div style="background:#db2777;color:white;padding:28px;border-radius:18px 18px 0 0"><h1 style="margin:0">Cintia Paula Festas e Decorações</h1></div><div style="border:1px solid #e5e7eb;border-top:0;padding:28px;border-radius:0 0 18px 18px"><h2 style="color:#be185d">Olá, ${nome}!</h2><p>Preparamos a proposta <strong>${numero}</strong>, no valor total de <strong>${total}</strong>.</p><p>Revise os itens, datas e condições antes de registrar sua decisão.</p><p style="margin:28px 0"><a href="${link}" style="background:#db2777;color:white;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:bold">Abrir proposta</a></p><p>Se precisar de ajustes, responda a este e-mail antes de aceitar.</p></div></div>`
    })
  })
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) {
    const mensagem = String(corpo?.message || 'Não foi possível enviar a proposta.')
    await supabaseServer.from('orcamentos').update({ email_erro: mensagem.slice(0, 500) }).eq('id', orcamento.id)
    throw new Error(mensagem)
  }

  await supabaseServer.from('orcamentos').update({
    email_enviado_em: new Date().toISOString(),
    email_destino: emailDestino,
    email_erro: null
  }).eq('id', orcamento.id)

  return { sucesso: true, destino: emailDestino, email_id: corpo.id || null, ignorado: false }
}
