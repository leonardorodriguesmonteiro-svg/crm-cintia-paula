import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import {
  JornadaComercialError,
  registrarRespostaProposta
} from '@/lib/application/comercial/jornadaComercialApplication'

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

async function buscarProposta(token: string) {
  const { data, error } = await supabaseServer
    .from('orcamentos')
    .select(`
      numero,status,validade,data_evento,horario_evento,data_retirada,data_devolucao,
      endereco_evento,subtotal,desconto,acrescimos,frete,total,observacoes,
      resposta_cliente,respondido_por,respondido_em,resposta_observacao,
      formalizacao_status,dados_cliente_completos_em,
      oportunidades(nome_contato),clientes(nome),
      orcamento_itens(descricao,quantidade,valor_unitario,subtotal,created_at)
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const oportunidade = relacaoUnica(data.oportunidades)
  const cliente = relacaoUnica(data.clientes)
  const expirada = ['Expirado', 'EXPIRADA'].includes(data.status) || Boolean(
    data.validade && data.validade < dataHojeBrasil()
  )

  return {
    numero: data.numero,
    status: expirada && ['Rascunho', 'Enviado', 'RASCUNHO', 'ENVIADA'].includes(data.status)
      ? (data.status === data.status.toUpperCase() ? 'EXPIRADA' : 'Expirado')
      : data.status,
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
    formalizacao_status: data.formalizacao_status,
    dados_cliente_completos: Boolean(data.dados_cliente_completos_em),
    precisa_completar_dados:
      data.status === 'ACEITA' && !data.dados_cliente_completos_em,
    pode_responder: !expirada && ['Rascunho', 'Enviado', 'ENVIADA'].includes(data.status)
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
  const nome = String(corpo.nome || '').trim().slice(0, 120)
  const observacao = String(corpo.observacao || '').trim().slice(0, 1000)

  if (!decisao || nome.length < 2) {
    return NextResponse.json(
      { error: 'Selecione uma resposta e informe seu nome.' },
      { status: 400 }
    )
  }

  try {
    const resposta = await registrarRespostaProposta({
      token,
      decisao,
      nome,
      observacao: observacao || null
    })

    return NextResponse.json({
      sucesso: true,
      mensagem: decisao === 'Aprovado'
        ? 'Proposta aceita. Complete seus dados para prepararmos o contrato.'
        : 'Resposta registrada. A equipe Cintia Paula recebeu sua decisão.',
      resposta
    })
  } catch (error) {
    if (error instanceof JornadaComercialError) {
      return NextResponse.json({ error: error.message }, { status: error.statusHttp })
    }
    const mensagem = error instanceof Error ? error.message : ''
    return NextResponse.json(
      { error: mensagem.includes('expirada') ? 'Esta proposta está expirada.' : 'Não foi possível registrar sua resposta.' },
      { status: mensagem.includes('expirada') ? 409 : 400 }
    )
  }
}
