import { NextRequest, NextResponse } from 'next/server'
import {
  criarPreReserva,
  JornadaComercialError
} from '@/lib/application/comercial/jornadaComercialApplication'
import type { ItemPreReservaInput } from '@/lib/application/comercial/jornadaComercial.types'
import { comercialJourneyRepository } from '@/lib/repositories/comercialJourneyRepository'
import {
  cabecalhosCors,
  empresaDoSite,
  hashDoSolicitante,
  JANELA_PRE_RESERVAS_SEGUNDOS,
  LIMITE_PRE_RESERVAS,
  origemEhPermitida,
  TAMANHO_MAXIMO_PRE_RESERVA
} from '@/lib/server/publicPreReservation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CorpoPreReserva = {
  nome?: unknown
  celular?: unknown
  email?: unknown
  data_evento?: unknown
  interesse?: unknown
  itens?: unknown
  website?: unknown
}

function textoOpcional(valor: unknown) {
  return typeof valor === 'string' ? valor : null
}

function emailPublicoValido(valor: unknown) {
  if (typeof valor !== 'string') return null
  const email = valor.trim().toLowerCase()
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null
  }
  return email
}

function itensDoCorpo(valor: unknown): ItemPreReservaInput[] {
  if (!Array.isArray(valor)) return []

  return valor.map(item => {
    const registro = item && typeof item === 'object'
      ? item as Record<string, unknown>
      : {}
    const quantidade = Number(registro.quantidade)
    const observacoes = textoOpcional(registro.observacoes)

    if (registro.tipo === 'KIT') {
      return {
        tipo: 'KIT' as const,
        kitId: String(registro.id || ''),
        quantidade,
        observacoes
      }
    }

    return {
      tipo: 'ITEM_ESTOQUE' as const,
      estoqueItemId: String(registro.id || ''),
      quantidade,
      observacoes
    }
  })
}

function resposta(
  origem: string,
  corpo: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(corpo, {
    status,
    headers: cabecalhosCors(origem)
  })
}

function validarOrigem(request: NextRequest) {
  return origemEhPermitida(request)
}

function detalhesSegurosDoErro(error: unknown) {
  if (error instanceof Error) {
    return {
      tipo: error.name,
      mensagem: error.message
    }
  }

  if (error && typeof error === 'object') {
    const registro = error as Record<string, unknown>
    return {
      tipo: 'ErroSupabase',
      codigo: typeof registro.code === 'string' ? registro.code : undefined,
      mensagem: typeof registro.message === 'string' ? registro.message : undefined,
      detalhe: typeof registro.details === 'string' ? registro.details : undefined,
      dica: typeof registro.hint === 'string' ? registro.hint : undefined
    }
  }

  return { tipo: typeof error }
}

export async function OPTIONS(request: NextRequest) {
  const origem = validarOrigem(request)
  if (!origem) return new NextResponse(null, { status: 403 })
  return new NextResponse(null, {
    status: 204,
    headers: cabecalhosCors(origem)
  })
}

export async function POST(request: NextRequest) {
  const origem = validarOrigem(request)
  if (!origem) {
    return NextResponse.json(
      { erro: 'Origem não autorizada.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    const tamanhoDeclarado = Number(request.headers.get('content-length') || 0)
    if (tamanhoDeclarado > TAMANHO_MAXIMO_PRE_RESERVA) {
      return resposta(origem, { erro: 'Solicitação muito grande.' }, 413)
    }

    const texto = await request.text()
    if (!texto || Buffer.byteLength(texto, 'utf8') > TAMANHO_MAXIMO_PRE_RESERVA) {
      return resposta(origem, { erro: 'Solicitação inválida ou muito grande.' }, 413)
    }

    let corpo: CorpoPreReserva
    try {
      corpo = JSON.parse(texto) as CorpoPreReserva
    } catch {
      return resposta(origem, { erro: 'JSON inválido.' }, 400)
    }

    // Campo honeypot: navegadores humanos deixam este campo invisível vazio.
    if (typeof corpo.website === 'string' && corpo.website.trim()) {
      return resposta(origem, {
        sucesso: true,
        mensagem: 'Pré-reserva recebida para análise.'
      }, 202)
    }

    const email = emailPublicoValido(corpo.email)
    if (!email) {
      return resposta(origem, {
        erro: 'Informe um e-mail válido. Ele será usado para o envio do orçamento, contrato e nota fiscal.',
        codigo: 'EMAIL_INVALIDO'
      }, 400)
    }

    const idempotencia = String(
      request.headers.get('idempotency-key') || ''
    ).trim()
    if (!/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencia)) {
      return resposta(origem, {
        erro: 'Envie uma chave Idempotency-Key válida.'
      }, 400)
    }

    const empresaId = empresaDoSite()
    const limiteDisponivel = await comercialJourneyRepository.consumirLimitePublico(
      empresaId,
      hashDoSolicitante(request, empresaId),
      LIMITE_PRE_RESERVAS,
      JANELA_PRE_RESERVAS_SEGUNDOS
    )

    if (!limiteDisponivel) {
      return resposta(origem, {
        erro: 'Muitas solicitações. Aguarde alguns minutos e tente novamente.'
      }, 429)
    }

    const preReserva = await criarPreReserva({
      empresaId,
      usuarioId: null,
      clienteId: null,
      nomeContato: String(corpo.nome || ''),
      celular: String(corpo.celular || ''),
      email,
      origem: 'Site',
      origemExternaId: `site:${idempotencia}`,
      dataEvento: textoOpcional(corpo.data_evento),
      interesse: textoOpcional(corpo.interesse),
      itens: itensDoCorpo(corpo.itens)
    })

    return resposta(origem, {
      sucesso: true,
      mensagem: preReserva.criada
        ? 'Pré-reserva recebida para análise.'
        : 'Esta pré-reserva já havia sido recebida.',
      pre_reserva: {
        numero: preReserva.numero,
        status: preReserva.status,
        criada: preReserva.criada
      },
      avisos: preReserva.avisos
    }, preReserva.criada ? 201 : 200)
  } catch (error) {
    if (error instanceof JornadaComercialError) {
      return resposta(origem, { erro: error.message, codigo: error.codigo }, error.statusHttp)
    }

    console.error(
      '[pre-reservas:publico] falha sem dados pessoais',
      detalhesSegurosDoErro(error)
    )
    return resposta(origem, {
      erro: 'Não foi possível registrar a pré-reserva agora.'
    }, 500)
  }
}
