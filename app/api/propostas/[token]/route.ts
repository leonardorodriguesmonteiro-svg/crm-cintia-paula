import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

type Contexto = {
  params: Promise<{ token: string }>
}

const tokenValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function relacaoUnica<T>(valor: T | T[] | null): T | null {
  if (Array.isArray(valor)) return valor[0] || null
  return valor
}

function dataHojeBrasil() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const valor = Object.fromEntries(partes.map(parte => [parte.type, parte.value]))
  return `${valor.year}-${valor.month}-${valor.day}`
}

function texto(valor: unknown, limite: number) {
  return String(valor || '').trim().slice(0, limite)
}

async function buscarProposta(token: string) {
  const { data, error } = await supabaseServer
    .from('orcamentos')
    .select(`
      numero,status,validade,data_evento,horario_evento,data_retirada,data_devolucao,
      endereco_evento,subtotal,desconto,acrescimos,frete,total,observacoes,
      resposta_cliente,respondido_por,respondido_em,resposta_observacao,
      cadastro_completo_em,bloqueio_temporario_ate,formalizacao_status,
      oportunidades(nome_contato,celular,email,jornada_status),
      clientes(nome,whatsapp,email),
      orcamento_itens(descricao,quantidade,valor_unitario,subtotal,created_at)
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const oportunidade = relacaoUnica(data.oportunidades)
  const cliente = relacaoUnica(data.clientes)
  const expirada = data.status === 'Expirado' || Boolean(
    data.validade && data.validade < dataHojeBrasil()
  )

  return {
    numero: data.numero,
    status: expirada && ['Rascunho', 'Enviado'].includes(data.status) ? 'Expirado' : data.status,
    validade: data.validade,
    data_evento: data.data_evento,
    horario_evento: data.horario_evento,
    data_retirada: data.data_retirada,
    data_devolucao: data.data_devolucao,
    endereco_evento: data.endereco_evento,
    subtotal: Number(data.subtotal),
    desconto: Number(data.desconto),
    acrescimos: Number(data.acrescimos),
    frete: Number(data.frete),
    total: Number(data.total),
    observacoes: data.observacoes,
    cliente: cliente?.nome || oportunidade?.nome_contato || 'Cliente',
    contato: {
      nome: cliente?.nome || oportunidade?.nome_contato || '',
      whatsapp: cliente?.whatsapp || oportunidade?.celular || '',
      email: cliente?.email || oportunidade?.email || ''
    },
    itens: [...(data.orcamento_itens || [])]
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(item => ({
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        subtotal: Number(item.subtotal)
      })),
    resposta_cliente: data.resposta_cliente,
    respondido_por: data.respondido_por,
    respondido_em: data.respondido_em,
    resposta_observacao: data.resposta_observacao,
    cadastro_completo: Boolean(data.cadastro_completo_em),
    cadastro_completo_em: data.cadastro_completo_em,
    bloqueio_temporario_ate: data.bloqueio_temporario_ate,
    formalizacao_status: data.formalizacao_status,
    jornada_status: oportunidade?.jornada_status || null,
    pode_responder: !expirada && ['Rascunho', 'Enviado'].includes(data.status),
    pode_completar_cadastro: !expirada && data.status === 'Aprovado' && !data.cadastro_completo_em
  }
}

export async function GET(_request: NextRequest, contexto: Contexto) {
  const { token } = await contexto.params

  if (!tokenValido.test(token)) {
    return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
  }

  try {
    const proposta = await buscarProposta(token)

    if (!proposta) {
      return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
    }

    return NextResponse.json(
      { proposta },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch {
    return NextResponse.json({ error: 'Não foi possível carregar esta proposta.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, contexto: Contexto) {
  const { token } = await contexto.params

  if (!tokenValido.test(token)) {
    return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
  }

  let corpo: { decisao?: string; nome?: string; observacao?: string }

  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Resposta inválida.' }, { status: 400 })
  }

  const decisao = corpo.decisao === 'Aprovado' || corpo.decisao === 'Recusado'
    ? corpo.decisao
    : null
  const nome = texto(corpo.nome, 120)
  const observacao = texto(corpo.observacao, 1000)

  if (!decisao || nome.length < 2) {
    return NextResponse.json(
      { error: 'Selecione uma resposta e informe seu nome.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseServer.rpc('registrar_resposta_publica_orcamento', {
    p_token: token,
    p_decisao: decisao,
    p_nome: nome,
    p_observacao: observacao || null
  })

  if (error) {
    const status = error.message.includes('expirada') || error.message.includes('dispon') ? 409 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({
    sucesso: true,
    mensagem: decisao === 'Aprovado'
      ? 'Proposta aprovada. Complete seus dados para seguirmos com o contrato.'
      : 'Resposta registrada. A equipe Cintia Paula recebeu sua decisão.',
    resposta: data
  })
}

export async function PATCH(request: NextRequest, contexto: Contexto) {
  const { token } = await contexto.params

  if (!tokenValido.test(token)) {
    return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
  }

  let corpo: Record<string, unknown>

  try {
    corpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const nome = texto(corpo.nome, 120)
  const documento = texto(corpo.documento, 30)
  const whatsapp = texto(corpo.whatsapp, 30)
  const email = texto(corpo.email, 180)
  const cep = texto(corpo.cep, 12)
  const endereco = texto(corpo.endereco, 180)
  const numero = texto(corpo.numero, 30)
  const complemento = texto(corpo.complemento, 100)
  const bairro = texto(corpo.bairro, 100)
  const cidade = texto(corpo.cidade, 100)
  const estado = texto(corpo.estado, 2).toUpperCase()

  if (!nome || !documento || !whatsapp || !email || !cep || !endereco || !numero || !bairro || !cidade || estado.length !== 2) {
    return NextResponse.json(
      { error: 'Preencha os dados obrigatórios do contratante.' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseServer.rpc('completar_cadastro_publico_orcamento', {
    p_token: token,
    p_nome: nome,
    p_documento: documento,
    p_whatsapp: whatsapp,
    p_email: email,
    p_cep: cep,
    p_endereco: endereco,
    p_numero: numero,
    p_complemento: complemento || null,
    p_bairro: bairro,
    p_cidade: cidade,
    p_estado: estado
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({
    sucesso: true,
    mensagem: 'Cadastro concluído. Agora a equipe pode gerar o contrato para assinatura.',
    cadastro: data
  })
}
