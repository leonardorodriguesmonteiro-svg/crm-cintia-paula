import { MercadoPagoConfig, Payment, Preference, WebhookSignatureValidator } from 'mercadopago'
import { supabaseServer } from '@/lib/supabaseServer'

export class MercadoPagoNaoConfiguradoError extends Error {
  constructor(mensagem = 'As credenciais do Mercado Pago ainda não foram configuradas.') {
    super(mensagem)
    this.name = 'MercadoPagoNaoConfiguradoError'
  }
}

function accessToken() {
  return String(process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim()
}

function webhookSecret() {
  return String(process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim()
}

function clienteMercadoPago() {
  const token = accessToken()
  if (!token) throw new MercadoPagoNaoConfiguradoError()
  return new MercadoPagoConfig({ accessToken: token, options: { timeout: 10000 } })
}

function origemSegura(origem: string) {
  const url = new URL(origem)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('A URL pública da aplicação precisa usar HTTPS.')
  }
  return url.origin
}

function somenteDigitos(valor: string | null | undefined) {
  return String(valor || '').replace(/\D/g, '')
}

function dadosPagador(cliente: {
  nome: string | null
  email: string | null
  cpf: string | null
  whatsapp: string | null
}) {
  const partesNome = String(cliente.nome || '').trim().split(/\s+/).filter(Boolean)
  const documento = somenteDigitos(cliente.cpf)
  const telefone = somenteDigitos(cliente.whatsapp)
  const payer: Record<string, unknown> = {}

  if (partesNome.length) {
    payer.name = partesNome[0]
    if (partesNome.length > 1) payer.surname = partesNome.slice(1).join(' ')
  }
  if (cliente.email?.includes('@')) payer.email = cliente.email.trim()
  if ([11, 14].includes(documento.length)) {
    payer.identification = { type: documento.length === 11 ? 'CPF' : 'CNPJ', number: documento }
  }
  if (telefone.length >= 10) {
    payer.phone = { area_code: telefone.slice(0, 2), number: telefone.slice(2) }
  }

  return payer
}

export function statusConfiguracaoMercadoPago() {
  return {
    access_token_configurado: Boolean(accessToken()),
    webhook_secret_configurado: Boolean(webhookSecret()),
    pronto: Boolean(accessToken() && webhookSecret())
  }
}

export async function criarOuObterPreferenciaMercadoPago(
  lancamentoId: string,
  origem: string,
  opcoes: { forcar?: boolean } = {}
) {
  const { data: lancamento, error: lancamentoError } = await supabaseServer
    .from('lancamentos_financeiros')
    .select('id,reserva_id,descricao,valor,data_vencimento,status,provedor_pagamento,provedor_preferencia_id,link_pagamento,status_provedor')
    .eq('id', lancamentoId)
    .maybeSingle()

  if (lancamentoError) throw lancamentoError
  if (!lancamento || lancamento.status === 'Pago') {
    return {
      criado: false,
      pago: lancamento?.status === 'Pago',
      link_pagamento: lancamento?.link_pagamento || null,
      preferencia_id: lancamento?.provedor_preferencia_id || null
    }
  }

  const podeReutilizar = lancamento.provedor_pagamento === 'Mercado Pago'
    && lancamento.provedor_preferencia_id
    && lancamento.link_pagamento
    && !['refunded', 'charged_back'].includes(lancamento.status_provedor || '')

  if (podeReutilizar && !opcoes.forcar) {
    return {
      criado: false,
      pago: false,
      link_pagamento: lancamento.link_pagamento,
      preferencia_id: lancamento.provedor_preferencia_id
    }
  }

  const { data: orcamento, error: orcamentoError } = await supabaseServer
    .from('orcamentos')
    .select('id,numero,contrato_id')
    .eq('lancamento_sinal_id', lancamento.id)
    .maybeSingle()

  if (orcamentoError) throw orcamentoError
  if (!orcamento?.contrato_id) throw new Error('O contrato desta cobrança não foi encontrado.')

  const { data: contrato, error: contratoError } = await supabaseServer
    .from('contratos')
    .select('public_token')
    .eq('id', orcamento.contrato_id)
    .maybeSingle()

  if (contratoError) throw contratoError
  if (!contrato?.public_token) throw new Error('O contrato ainda não possui um link público.')

  const { data: reserva, error: reservaError } = await supabaseServer
    .from('reservas')
    .select('cliente_id')
    .eq('id', lancamento.reserva_id)
    .maybeSingle()

  if (reservaError) throw reservaError
  if (!reserva?.cliente_id) throw new Error('O cliente da cobrança não foi encontrado.')

  const { data: cliente, error: clienteError } = await supabaseServer
    .from('clientes')
    .select('nome,email,cpf,whatsapp')
    .eq('id', reserva.cliente_id)
    .maybeSingle()

  if (clienteError) throw clienteError
  if (!cliente) throw new Error('O cliente da cobrança não foi encontrado.')

  const baseUrl = origemSegura(origem)
  const contratoUrl = `${baseUrl}/contrato/${contrato.public_token}`
  const numeroOrcamento = `ORC-${String(orcamento.numero).padStart(4, '0')}`
  const valor = Number(lancamento.valor || 0)

  if (!Number.isFinite(valor) || valor <= 0) throw new Error('O valor do sinal é inválido.')

  const preference = new Preference(clienteMercadoPago())
  const resposta = await preference.create({
    body: {
      items: [{
        id: lancamento.id,
        title: `Sinal ${numeroOrcamento}`,
        description: 'Sinal da reserva Cintia Paula Festas e Decorações',
        category_id: 'services',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: valor
      }],
      external_reference: `sinal:${lancamento.id}`,
      metadata: {
        lancamento_id: lancamento.id,
        orcamento_id: orcamento.id,
        contrato_id: orcamento.contrato_id
      },
      payer: dadosPagador(cliente),
      payment_methods: { installments: 1, default_installments: 1 },
      statement_descriptor: 'CINTIA PAULA',
      notification_url: `${baseUrl}/api/webhooks/mercado-pago`,
      back_urls: {
        success: `${contratoUrl}?pagamento=aprovado#pagamento`,
        pending: `${contratoUrl}?pagamento=pendente#pagamento`,
        failure: `${contratoUrl}?pagamento=recusado#pagamento`
      },
      auto_return: 'approved'
    },
    requestOptions: {
      idempotencyKey: opcoes.forcar
        ? `sinal-${lancamento.id}-${Date.now()}`
        : `sinal-${lancamento.id}`
    }
  })

  if (!resposta.id || !resposta.init_point) {
    throw new Error('O Mercado Pago não retornou o link da cobrança.')
  }

  const { error: registroError } = await supabaseServer.rpc('registrar_preferencia_mercado_pago', {
    p_lancamento_id: lancamento.id,
    p_preferencia_id: resposta.id,
    p_link_pagamento: resposta.init_point
  })

  if (registroError) throw registroError

  return {
    criado: true,
    pago: false,
    link_pagamento: resposta.init_point,
    preferencia_id: resposta.id
  }
}

export function validarWebhookMercadoPago(dados: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string | null
}) {
  const secret = webhookSecret()
  if (!secret) throw new MercadoPagoNaoConfiguradoError('A assinatura secreta do webhook ainda não foi configurada.')

  WebhookSignatureValidator.validate({
    xSignature: dados.xSignature,
    xRequestId: dados.xRequestId,
    dataId: dados.dataId,
    secret,
    toleranceSeconds: 300
  })
}

export async function consultarPagamentoMercadoPago(pagamentoId: string) {
  const payment = new Payment(clienteMercadoPago())
  return payment.get({ id: pagamentoId })
}

export async function buscarPagamentoMercadoPagoPorReferencia(referencia: string) {
  const payment = new Payment(clienteMercadoPago())
  const resposta = await payment.search({
    options: {
      external_reference: referencia,
      sort: 'date_last_updated',
      criteria: 'desc',
      limit: 10
    }
  })
  const pagamentos = resposta.results || []

  return pagamentos.find(item => String(item.status || '').toLowerCase() === 'approved')
    || pagamentos[0]
    || null
}

type PagamentoConciliavel = {
  id?: string | number | null
  status?: string | null
  status_detail?: string | null
  external_reference?: string | null
  payment_method_id?: string | null
  payment_type_id?: string | null
  transaction_amount?: number | null
  date_approved?: string | null
}

export async function conciliarPagamentoMercadoPago(
  lancamentoId: string,
  pagamento: PagamentoConciliavel
) {
  const pagamentoId = String(pagamento.id || '').trim()
  const referenciaEsperada = `sinal:${lancamentoId}`

  if (!pagamentoId || pagamento.external_reference !== referenciaEsperada) {
    throw new Error('O pagamento não corresponde a esta cobrança de sinal.')
  }

  const status = String(pagamento.status || 'unknown').toLowerCase()
  const formaPagamento = `Mercado Pago · ${pagamento.payment_method_id || pagamento.payment_type_id || 'online'}`
  const { data, error } = await supabaseServer.rpc('conciliar_pagamento_mercado_pago', {
    p_lancamento_id: lancamentoId,
    p_pagamento_id: pagamentoId,
    p_status: status,
    p_status_detalhe: pagamento.status_detail || null,
    p_forma_pagamento: formaPagamento,
    p_valor: Number(pagamento.transaction_amount || 0),
    p_pago_em: pagamento.date_approved || null
  })

  if (error) throw error

  return {
    ...data,
    pagamento_id: pagamentoId,
    status,
    conciliado: status === 'approved'
  }
}
