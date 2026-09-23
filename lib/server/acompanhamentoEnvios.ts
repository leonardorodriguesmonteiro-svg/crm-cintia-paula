import { supabaseServer } from '@/lib/supabaseServer'
import { gerarLink, hashToken } from './acompanhamento'

type Canal = 'email' | 'whatsapp'
type Finalidade = 'recebimento' | 'aprovacao'
const tabelaEnvios = (finalidade: Finalidade) => finalidade === 'aprovacao' ? 'acompanhamento_aprovacao_envios' : 'acompanhamento_envios'
export async function consultarEnvios(id: string, finalidade: Finalidade = 'recebimento') {
  const { data: link, error: erroLink } = await supabaseServer.from('acompanhamento_links').select('token_hash').eq('oportunidade_id', id).single()
  if (erroLink) throw new Error('Não foi possível consultar o link.')
  const { data, error } = await supabaseServer.from(tabelaEnvios(finalidade))
    .select('canal,status,atualizado_em').eq('oportunidade_id', id).eq('token_hash', link.token_hash).order('atualizado_em', { ascending: false }).limit(10)
  if (error) throw new Error('Não foi possível consultar os envios.')
  return data || []
}
// An accepted provider request is not proof of delivery. Uncertain requests are
// never retried automatically, to avoid duplicate WhatsApp notifications.
export async function enviarAcompanhamento(id: string, empresaId: string, canais: Canal[] = ['email', 'whatsapp'], finalidade: Finalidade = 'recebimento') {
  const url = await gerarLink(id, empresaId)
  const tokenHash = hashToken(url.split('#')[1])
  const { data: pedido, error } = await supabaseServer.from('oportunidades')
    .select('numero,email,celular').eq('id', id).eq('empresa_id', empresaId).single()
  if (error || !pedido) throw new Error('Pedido não encontrado.')
  const { data: link, error: erroLink } = await supabaseServer.from('acompanhamento_links')
    .select('whatsapp_consentido_em').eq('oportunidade_id', id).single()
  if (erroLink) throw new Error('Não foi possível consultar a autorização de envio.')
  await Promise.all(canais.map(async canal => {
    const insercao = await supabaseServer.from(tabelaEnvios(finalidade)).upsert({
      oportunidade_id: id, token_hash: tokenHash, canal, status: 'pendente'
    }, { onConflict: 'oportunidade_id,token_hash,canal', ignoreDuplicates: true })
    if (insercao.error) throw new Error('Não foi possível registrar o envio.')
    const { data: envio, error: erroClaim } = await supabaseServer.from(tabelaEnvios(finalidade))
      .update({ status: 'processando', atualizado_em: new Date().toISOString() })
      .eq('oportunidade_id', id).eq('token_hash', tokenHash).eq('canal', canal)
      .in('status', ['pendente','falhou','nao_configurado','sem_consentimento','sem_destino'])
      .select('id').maybeSingle()
    if (erroClaim) throw new Error('Não foi possível iniciar o envio.')
    if (!envio) return
    let status = 'nao_configurado'
    let provedorId: string | null = null
    try {
      if (canal === 'whatsapp' && !link?.whatsapp_consentido_em) status = 'sem_consentimento'
      else {
        const telefone = String(pedido.celular || '').replace(/\D/g, '')
        const destino = canal === 'email' ? String(pedido.email || '').trim() : (/^\d{10,11}$/.test(telefone) ? `55${telefone}` : telefone)
        if (canal === 'email' ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino) : !/^55\d{10,11}$/.test(destino)) status = 'sem_destino'
        else {
          const emailConfigurado = process.env.RESEND_API_KEY && process.env.EMAIL_REMETENTE
          const whatsappConfigurado = process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME && /^v\d+\.0$/.test(process.env.WHATSAPP_GRAPH_VERSION || '')
          if (canal === 'email' ? emailConfigurado : whatsappConfigurado) {
            const resposta = await fetch(canal === 'email' ? 'https://api.resend.com/emails'
              : `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
              method: 'POST', signal: AbortSignal.timeout(10000),
              headers: { 'Content-Type': 'application/json',
                Authorization: `Bearer ${canal === 'email' ? process.env.RESEND_API_KEY : process.env.WHATSAPP_ACCESS_TOKEN}`,
                ...(canal === 'email' ? { 'Idempotency-Key': `acompanhamento-${finalidade}-${envio.id}` } : {}) },
              body: JSON.stringify(canal === 'email' ? {
                from: process.env.EMAIL_REMETENTE, to: [destino],
                ...(process.env.EMAIL_RESPOSTA ? { reply_to: process.env.EMAIL_RESPOSTA } : {}),
                subject: finalidade === 'aprovacao' ? `Pré-reserva #${pedido.numero} aprovada — complete seu cadastro` : `Acompanhe seu pedido #${pedido.numero} — Cintia Paula`,
                text: finalidade === 'aprovacao' ? `Sua pré-reserva #${pedido.numero} foi aprovada!\n\nComplete seu cadastro neste link privado para prepararmos o orçamento final: ${url}\n\nA aprovação da pré-reserva ainda não confirma a reserva. Você receberá o orçamento para conferir e aceitar.\nCintia Paula Festas e Decorações` : `Recebemos sua solicitação #${pedido.numero}.\n\nAcompanhe seu pedido: ${url}\n\nGuarde este link privado. A solicitação ainda depende de análise e confirmação da equipe.\nCintia Paula Festas e Decorações`
              } : { messaging_product: 'whatsapp', to: destino, type: 'template', template: {
                name: process.env.WHATSAPP_TEMPLATE_NAME,
                language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR' },
                components: [{ type: 'body', parameters: [{ type: 'text', text: String(pedido.numero) }, { type: 'text', text: url }] }]
              } })
            })
            // 5xx may have processed the request. Keep it for provider review.
            status = resposta.ok ? 'aceito' : resposta.status >= 500 ? 'incerto' : 'falhou'
            const corpo = await resposta.json().catch(() => null)
            provedorId = canal === 'email' ? corpo?.id || null : corpo?.messages?.[0]?.id || null
            if (resposta.ok && !provedorId) status = 'incerto'
          }
        }
      }
    } catch { status = 'incerto' }
    const salvo = await supabaseServer.from(tabelaEnvios(finalidade))
      .update({ status, provedor_id: provedorId, atualizado_em: new Date().toISOString() }).eq('id', envio.id)
    if (salvo.error) throw new Error('Envio iniciado; não foi possível atualizar seu status. Confira o provedor antes de repetir.')
  }))
  return consultarEnvios(id, finalidade)
}
