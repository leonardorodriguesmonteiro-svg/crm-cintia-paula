import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { formatarEnderecoCompleto } from '@/lib/endereco'
import { publicarConfirmacaoReservaV2 } from '@/lib/formalizacaoConfirmacao'
import { criarOuObterPreferenciaMercadoPago, MercadoPagoNaoConfiguradoError } from '@/lib/mercadoPago'
import { gerarPixCopiaECola } from '@/lib/pix'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

type Contexto = {
  params: Promise<{ id: string }>
}

const tokenValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function linkHttps(valor: string | null | undefined) {
  if (!valor) return null
  try {
    const url = new URL(valor)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function documentoMascarado(valor: string | null) {
  if (!valor) return null
  const digitos = valor.replace(/\D/g, '')
  return digitos.length >= 4 ? `•••• ${digitos.slice(-4)}` : null
}

async function buscarContrato(token: string) {
  const { data: contrato, error: contratoError } = await supabaseServer
    .from('contratos')
    .select('id,numero_contrato,status,reserva_id,created_at,assinado_em,assinado_por,assinatura_documento,assinatura_aceite')
    .eq('public_token', token)
    .maybeSingle()

  if (contratoError) throw contratoError
  if (!contrato) return null

  const { data: reserva, error: reservaError } = await supabaseServer
    .from('reservas')
    .select('id,cliente_id,kit_id,data_evento,horario_evento,endereco_evento,valor_total,valor_sinal,status_pagamento')
    .eq('id', contrato.reserva_id)
    .maybeSingle()

  if (reservaError) throw reservaError
  if (!reserva) return null

  const [clienteRes, kitRes, itensRes, orcamentoRes, configuracaoRes, empresaRes] = await Promise.all([
    supabaseServer.from('clientes').select('nome,cpf,rg,whatsapp,email,cep,endereco,numero,complemento,bairro,cidade,estado').eq('id', reserva.cliente_id).maybeSingle(),
    supabaseServer.from('kits').select('nome,codigo').eq('id', reserva.kit_id).maybeSingle(),
    supabaseServer
      .from('reserva_itens')
      .select('descricao,quantidade,valor_unitario,subtotal,kit_id')
      .eq('reserva_id', reserva.id)
      .order('ordem', { ascending: true }),
    supabaseServer
      .from('orcamentos')
      .select('numero,formalizacao_status,valor_sinal_formalizacao,vencimento_sinal,sinal_pago_em,lancamento_sinal_id')
      .eq('contrato_id', contrato.id)
      .maybeSingle(),
    supabaseServer
      .from('configuracoes_pagamento')
      .select('pix_chave,pix_beneficiario,pix_cidade,link_pagamento,instrucoes')
      .eq('id', true)
      .maybeSingle(),
    supabaseServer
      .from('empresas')
      .select('nome,nome_fantasia,razao_social,cnpj,email,telefone,whatsapp,site,logradouro,numero,complemento,bairro,cidade,estado,logo_url,contrato_padrao')
      .limit(1)
      .maybeSingle()
  ])

  const primeiroErro = clienteRes.error || kitRes.error || itensRes.error || orcamentoRes.error || configuracaoRes.error || empresaRes.error
  if (primeiroErro) throw primeiroErro

  const orcamento = orcamentoRes.data
  const configuracao = configuracaoRes.data
  const lancamentoRes = orcamento?.lancamento_sinal_id
    ? await supabaseServer
        .from('lancamentos_financeiros')
        .select('link_pagamento,provedor_pagamento,status_provedor')
        .eq('id', orcamento.lancamento_sinal_id)
        .maybeSingle()
    : { data: null, error: null }

  if (lancamentoRes.error) throw lancamentoRes.error

  const lancamento = lancamentoRes.data
  const valorSinal = Number(orcamento?.valor_sinal_formalizacao || reserva.valor_sinal || 0)
  const sinalPago = Boolean(orcamento?.sinal_pago_em) || ['Sinal pago', 'Pago', 'Quitado'].includes(reserva.status_pagamento || '')
  const pixCopiaECola = configuracao?.pix_chave && !sinalPago
    ? gerarPixCopiaECola({
        chave: configuracao.pix_chave,
        beneficiario: configuracao.pix_beneficiario,
        cidade: configuracao.pix_cidade,
        valor: valorSinal,
        identificador: orcamento?.numero ? `ORC${String(orcamento.numero).padStart(4, '0')}` : contrato.numero_contrato
      })
    : null

  return {
    empresa: {
      nome: empresaRes.data?.nome_fantasia || empresaRes.data?.nome || 'Cintia Paula',
      razao_social: empresaRes.data?.razao_social || null,
      cnpj: empresaRes.data?.cnpj || null,
      email: empresaRes.data?.email || null,
      telefone: empresaRes.data?.telefone || null,
      whatsapp: empresaRes.data?.whatsapp || null,
      site: empresaRes.data?.site || null,
      endereco: formatarEnderecoCompleto([empresaRes.data?.logradouro, empresaRes.data?.numero, empresaRes.data?.complemento, empresaRes.data?.bairro, empresaRes.data?.cidade, empresaRes.data?.estado]) || null,
      logo_url: empresaRes.data?.logo_url || null,
      contrato_padrao: empresaRes.data?.contrato_padrao || null
    },
    numero: contrato.numero_contrato,
    status: contrato.status || 'Gerado',
    criado_em: contrato.created_at,
    cliente: clienteRes.data?.nome || 'Cliente',
    contratante: {
      nome: clienteRes.data?.nome || 'Cliente',
      cpf: clienteRes.data?.cpf || null,
      rg: clienteRes.data?.rg || null,
      whatsapp: clienteRes.data?.whatsapp || null,
      email: clienteRes.data?.email || null,
      endereco: formatarEnderecoCompleto([
        clienteRes.data?.endereco,
        clienteRes.data?.numero,
        clienteRes.data?.complemento,
        clienteRes.data?.bairro,
        clienteRes.data?.cidade,
        clienteRes.data?.estado
      ], clienteRes.data?.cep) || null
    },
    evento: {
      data: reserva.data_evento,
      horario: reserva.horario_evento,
      endereco: reserva.endereco_evento
    },
    kit: {
      nome: kitRes.data?.nome || 'Kit não informado',
      codigo: kitRes.data?.codigo || null
    },
    itens: (itensRes.data || []).map(item => ({
      descricao: item.descricao,
      quantidade: Number(item.quantidade || 0),
      valor_unitario: Number(item.valor_unitario || 0),
      subtotal: Number(item.subtotal || 0),
      kit: Boolean(item.kit_id)
    })),
    valor_total: Number(reserva.valor_total || 0),
    assinatura: contrato.status === 'Assinado' ? {
      nome: contrato.assinado_por,
      documento: documentoMascarado(contrato.assinatura_documento),
      em: contrato.assinado_em,
      aceite: Boolean(contrato.assinatura_aceite)
    } : null,
    pode_assinar: !['Assinado', 'Cancelado'].includes(contrato.status || ''),
    pagamento: {
      valor_sinal: valorSinal,
      vencimento: orcamento?.vencimento_sinal || null,
      pago: sinalPago,
      pix_chave: configuracao?.pix_chave || null,
      pix_copia_cola: pixCopiaECola,
      link: linkHttps(lancamento?.link_pagamento) || linkHttps(configuracao?.link_pagamento),
      provedor: lancamento?.provedor_pagamento || null,
      status_provedor: lancamento?.status_provedor || null,
      instrucoes: configuracao?.instrucoes || 'Após o pagamento, envie o comprovante para a equipe Cintia Paula.'
    }
  }
}

export async function GET(_request: NextRequest, contexto: Contexto) {
  const { id: token } = await contexto.params

  if (!tokenValido.test(token)) {
    return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  }

  try {
    const contrato = await buscarContrato(token)
    if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })

    return NextResponse.json(
      { contrato },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar este contrato.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, contexto: Contexto) {
  const { id: token } = await contexto.params

  if (!tokenValido.test(token)) {
    return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })
  }

  let corpo: { nome?: string; documento?: string; aceite?: boolean }

  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 })
  }

  const nome = String(corpo.nome || '').trim().slice(0, 120)
  const documento = String(corpo.documento || '').replace(/\D/g, '').slice(0, 14)

  if (!corpo.aceite || nome.length < 2 || ![11, 14].includes(documento.length)) {
    return NextResponse.json(
      { error: 'Informe seu nome, CPF ou CNPJ e confirme o aceite do contrato.' },
      { status: 400 }
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'indisponivel'
  const segredoAuditoria = process.env.CONTRATO_AUDIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const ipHash = createHash('sha256').update(`${segredoAuditoria}:${ip}`).digest('hex')
  const userAgent = String(request.headers.get('user-agent') || '').slice(0, 500)

  const { data, error } = await supabaseServer.rpc('registrar_assinatura_publica_contrato', {
    p_token: token,
    p_nome: nome,
    p_documento: documento,
    p_ip_hash: ipHash,
    p_user_agent: userAgent
  })

  if (error) {
    const status = error.message.includes('não encontrado') ? 404 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  const eventoConfirmacao = await publicarConfirmacaoReservaV2(
    data || {},
    'Contrato · assinatura pública'
  )

  let cobranca: { link_pagamento: string | null; criado: boolean } | null = null
  let avisoPagamento: string | null = null

  try {
    const { data: contrato } = await supabaseServer
      .from('contratos')
      .select('id')
      .eq('public_token', token)
      .maybeSingle()

    const { data: orcamento } = contrato
      ? await supabaseServer
          .from('orcamentos')
          .select('lancamento_sinal_id')
          .eq('contrato_id', contrato.id)
          .maybeSingle()
      : { data: null }

    if (orcamento?.lancamento_sinal_id) {
      cobranca = await criarOuObterPreferenciaMercadoPago(
        orcamento.lancamento_sinal_id,
        request.nextUrl.origin
      )
    }
  } catch (error) {
    if (!(error instanceof MercadoPagoNaoConfiguradoError)) {
      avisoPagamento = 'A assinatura foi registrada, mas o link do Mercado Pago precisará ser gerado pela equipe.'
    }
  }

  return NextResponse.json({
    sucesso: true,
    mensagem: data?.mensagem,
    assinatura: data,
    cobranca,
    aviso_pagamento: avisoPagamento,
    avisos: eventoConfirmacao.avisos
  })
}
