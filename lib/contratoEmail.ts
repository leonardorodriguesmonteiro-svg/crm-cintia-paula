import { supabaseServer } from '@/lib/supabaseServer'

export class EmailContratoNaoConfiguradoError extends Error {
  constructor() {
    super('O envio automático de e-mail ainda não foi conectado. Configure RESEND_API_KEY e EMAIL_REMETENTE na Vercel.')
    this.name = 'EmailContratoNaoConfiguradoError'
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

type OpcoesEnvioContrato = {
  reenviar?: boolean
}

export async function enviarContratoPorEmail(
  contratoId: string,
  origem: string,
  opcoes: OpcoesEnvioContrato = {}
) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim()
  const remetente = String(process.env.EMAIL_REMETENTE || '').trim()
  const respostaPara = String(process.env.EMAIL_RESPOSTA || '').trim()

  const { data: contrato, error: contratoError } = await supabaseServer
    .from('contratos')
    .select('id,numero_contrato,public_token,status,reserva_id,email_enviado_em,email_destino')
    .eq('id', contratoId)
    .maybeSingle()

  if (contratoError) throw contratoError
  if (!contrato?.public_token || !contrato.reserva_id) throw new Error('Contrato não encontrado ou sem link público.')

  if (contrato.email_enviado_em && !opcoes.reenviar) {
    return {
      sucesso: true,
      destino: contrato.email_destino,
      email_id: null,
      ignorado: true
    }
  }

  if (!apiKey || !remetente) throw new EmailContratoNaoConfiguradoError()

  const { data: reserva, error: reservaError } = await supabaseServer
    .from('reservas')
    .select('cliente_id,data_evento')
    .eq('id', contrato.reserva_id)
    .maybeSingle()

  if (reservaError) throw reservaError
  if (!reserva?.cliente_id) throw new Error('Cliente do contrato não encontrado.')

  const { data: cliente, error: clienteError } = await supabaseServer
    .from('clientes')
    .select('nome,email')
    .eq('id', reserva.cliente_id)
    .maybeSingle()

  if (clienteError) throw clienteError
  if (!emailValido(cliente?.email)) {
    throw new Error('Cadastre um e-mail válido do cliente antes de enviar o contrato.')
  }

  const emailDestino = String(cliente!.email).trim().toLowerCase()
  const link = `${new URL(origem).origin}/contrato/${contrato.public_token}`
  const nome = escaparHtml(cliente?.nome || 'cliente')
  const numero = escaparHtml(contrato.numero_contrato)
  const dataEvento = reserva.data_evento
    ? new Date(`${reserva.data_evento}T12:00:00`).toLocaleDateString('pt-BR')
    : 'a combinar'

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: remetente,
      to: [emailDestino],
      ...(respostaPara ? { reply_to: respostaPara } : {}),
      subject: `Bem-vinda à Cintia Paula — contrato ${contrato.numero_contrato}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937;line-height:1.6">
          <div style="background:#db2777;color:white;padding:28px;border-radius:18px 18px 0 0">
            <h1 style="margin:0">Cintia Paula Festas e Decorações</h1>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:0;padding:28px;border-radius:0 0 18px 18px">
            <h2 style="color:#be185d">Olá, ${nome}! Seja muito bem-vinda.</h2>
            <p>É uma alegria fazer parte deste momento especial. Preparamos o contrato <strong>${numero}</strong> para o evento de <strong>${dataEvento}</strong>.</p>
            <p>Use o botão abaixo para revisar os dados, consultar todos os termos e condições, assinar eletronicamente e baixar sua via.</p>
            <p style="margin:28px 0"><a href="${link}" style="background:#db2777;color:white;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:bold">Abrir contrato</a></p>
            <p>Se precisar de qualquer ajuste, responda a este e-mail e fale com a nossa equipe.</p>
            <p style="margin-top:28px">Com carinho,<br><strong>Equipe Cintia Paula</strong></p>
          </div>
        </div>
      `
    })
  })

  const corpo = await resposta.json().catch(() => ({}))

  if (!resposta.ok) {
    const mensagem = String(corpo?.message || 'Não foi possível enviar o e-mail do contrato.')
    await supabaseServer.from('contratos').update({ email_erro: mensagem.slice(0, 500) }).eq('id', contrato.id)
    throw new Error(mensagem)
  }

  await supabaseServer
    .from('contratos')
    .update({
      status: contrato.status === 'Gerado' ? 'Enviado' : contrato.status,
      email_enviado_em: new Date().toISOString(),
      email_destino: emailDestino,
      email_erro: null
    })
    .eq('id', contrato.id)

  return {
    sucesso: true,
    destino: emailDestino,
    email_id: corpo.id || null,
    ignorado: false
  }
}
