import {
  podeTransicionarPreReserva,
  statusPreReserva,
  type StatusPreReserva
} from '@/lib/domain/comercial/jornadaComercial'
import { ERPEvents, type ERPEventCode } from '@/lib/events/catalog'
import { publicarEvento } from '@/lib/events/eventBus'
import { comercialJourneyRepository } from '@/lib/repositories/comercialJourneyRepository'
import type {
  CriarPreReservaInput,
  PreReservaCriada,
  PreReservaTransicionada,
  TransicionarPreReservaInput
} from './jornadaComercial.types'

export class JornadaComercialError extends Error {
  constructor(
    message: string,
    public readonly codigo: string,
    public readonly statusHttp = 400
  ) {
    super(message)
    this.name = 'JornadaComercialError'
  }
}

function validarCriacao(input: CriarPreReservaInput) {
  const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  if (!input.empresaId) {
    throw new JornadaComercialError(
      'Empresa não informada.',
      'EMPRESA_NAO_INFORMADA'
    )
  }

  if (input.nomeContato.trim().length < 2) {
    throw new JornadaComercialError(
      'Informe o nome do cliente.',
      'NOME_INVALIDO'
    )
  }

  const celular = input.celular.replace(/\D/g, '')
  if (!/^\d{10,11}$/.test(celular)) {
    throw new JornadaComercialError(
      'Informe um celular com DDD.',
      'CELULAR_INVALIDO'
    )
  }

  if (!input.itens.length || input.itens.length > 100) {
    throw new JornadaComercialError(
      'A pré-reserva deve conter de 1 a 100 itens.',
      'ITENS_INVALIDOS'
    )
  }

  if (input.email) {
    const email = input.email.trim()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new JornadaComercialError(
        'Informe um e-mail válido.',
        'EMAIL_INVALIDO'
      )
    }
  }

  if (input.origemExternaId && input.origemExternaId.trim().length > 200) {
    throw new JornadaComercialError(
      'Identificador externo muito longo.',
      'IDEMPOTENCIA_INVALIDA'
    )
  }

  if (input.dataEvento) {
    const formatoValido = /^\d{4}-\d{2}-\d{2}$/.test(input.dataEvento)
    const dataValida = !Number.isNaN(Date.parse(`${input.dataEvento}T12:00:00Z`))
    if (!formatoValido || !dataValida) {
      throw new JornadaComercialError(
        'Informe uma data de evento válida.',
        'DATA_EVENTO_INVALIDA'
      )
    }
  }

  if (input.itens.some(item => !Number.isFinite(item.quantidade) || item.quantidade <= 0)) {
    throw new JornadaComercialError(
      'Todos os itens devem ter quantidade maior que zero.',
      'QUANTIDADE_INVALIDA'
    )
  }

  if (input.itens.some(item => {
    const id = item.tipo === 'KIT' ? item.kitId : item.estoqueItemId
    return !uuidValido.test(id) || (item.observacoes?.length || 0) > 1000
  })) {
    throw new JornadaComercialError(
      'Um ou mais itens possuem dados inválidos.',
      'REFERENCIA_ITEM_INVALIDA'
    )
  }
}

function eventoDaTransicao(status: StatusPreReserva): ERPEventCode {
  const eventos: Partial<Record<StatusPreReserva, ERPEventCode>> = {
    EM_ANALISE: ERPEvents.PRE_RESERVA_EM_ANALISE,
    AJUSTE_SOLICITADO: ERPEvents.PRE_RESERVA_AJUSTE_SOLICITADO,
    APROVADA: ERPEvents.PRE_RESERVA_APROVADA,
    RECUSADA: ERPEvents.PRE_RESERVA_RECUSADA,
    CONVERTIDA_EM_PROPOSTA:
      ERPEvents.PRE_RESERVA_CONVERTIDA_EM_PROPOSTA
  }

  const evento = eventos[status]
  if (!evento) {
    throw new JornadaComercialError(
      'Transição sem evento comercial correspondente.',
      'EVENTO_NAO_MAPEADO'
    )
  }
  return evento
}

function avisosDoEvento(resultado: Awaited<ReturnType<typeof publicarEvento>>) {
  return resultado.sucesso
    ? []
    : resultado.erros.map(erro => `Evento pendente: ${erro}`)
}

export async function criarPreReserva(
  input: CriarPreReservaInput
): Promise<PreReservaCriada> {
  validarCriacao(input)

  const preReserva = await comercialJourneyRepository.criarPreReserva({
    ...input,
    nomeContato: input.nomeContato.trim(),
    celular: input.celular.replace(/\D/g, ''),
    email: input.email?.trim().toLowerCase() || null,
    origem: input.origem?.trim() || 'Site',
    origemExternaId: input.origemExternaId?.trim() || null,
    interesse: input.interesse?.trim() || null
  })

  if (!preReserva.criada) {
    return {
      ...preReserva,
      status: preReserva.status as StatusPreReserva,
      avisos: []
    }
  }

  const evento = await publicarEvento({
    codigo: ERPEvents.PRE_RESERVA_RECEBIDA,
    titulo: `Pré-reserva #${preReserva.numero} recebida`,
    descricao: 'Solicitação recebida para análise comercial.',
    empresaId: input.empresaId,
    entidadeTipo: 'PreReserva',
    entidadeId: preReserva.id,
    modulo: 'Comercial',
    origem: input.origem?.trim() || 'Site',
    status: preReserva.status,
    usuarioId: input.usuarioId || null,
    metadados: {
      numero: preReserva.numero,
      quantidadeItens: input.itens.length
    }
  })

  return {
    ...preReserva,
    status: preReserva.status as StatusPreReserva,
    avisos: avisosDoEvento(evento)
  }
}

export async function transicionarPreReserva(
  input: TransicionarPreReservaInput
): Promise<PreReservaTransicionada> {
  const atual = await comercialJourneyRepository.buscarPreReserva(
    input.oportunidadeId,
    input.empresaId
  )

  if (!atual) {
    throw new JornadaComercialError(
      'Pré-reserva não encontrada para esta empresa.',
      'PRE_RESERVA_NAO_ENCONTRADA',
      404
    )
  }

  if (!statusPreReserva.includes(atual.etapa as StatusPreReserva)) {
    throw new JornadaComercialError(
      'Esta oportunidade ainda usa um estado legado e precisa ser migrada antes da transição.',
      'ESTADO_LEGADO',
      409
    )
  }

  const statusAtual = atual.etapa as StatusPreReserva
  if (statusAtual === input.proximoStatus) {
    return {
      id: atual.id,
      numero: atual.numero,
      statusAnterior: statusAtual,
      status: statusAtual,
      versao: atual.versao,
      avisos: []
    }
  }

  if (!podeTransicionarPreReserva(statusAtual, input.proximoStatus)) {
    throw new JornadaComercialError(
      `Não é permitido alterar a pré-reserva de ${statusAtual} para ${input.proximoStatus}.`,
      'TRANSICAO_INVALIDA',
      409
    )
  }

  const persistida = await comercialJourneyRepository.transicionarPreReserva(input)
  const evento = await publicarEvento({
    codigo: eventoDaTransicao(input.proximoStatus),
    titulo: `Pré-reserva #${persistida.numero}: ${input.proximoStatus}`,
    descricao: input.observacao?.trim() || 'Etapa comercial atualizada.',
    empresaId: input.empresaId,
    entidadeTipo: 'PreReserva',
    entidadeId: persistida.id,
    modulo: 'Comercial',
    origem: 'ERP',
    status: persistida.status,
    usuarioId: input.usuarioId,
    metadados: {
      numero: persistida.numero,
      statusAnterior: persistida.status_anterior,
      versao: persistida.versao
    }
  })

  return {
    id: persistida.id,
    numero: persistida.numero,
    statusAnterior: persistida.status_anterior as StatusPreReserva,
    status: persistida.status as StatusPreReserva,
    versao: persistida.versao,
    avisos: avisosDoEvento(evento)
  }
}

export async function registrarRespostaProposta(input: {
  token: string
  decisao: 'Aprovado' | 'Recusado'
  nome: string
  observacao?: string | null
}) {
  if (input.nome.trim().length < 2 || input.nome.trim().length > 120) {
    throw new JornadaComercialError('Informe seu nome.', 'NOME_INVALIDO')
  }
  if ((input.observacao?.length || 0) > 1000) {
    throw new JornadaComercialError('A observação é muito longa.', 'OBSERVACAO_INVALIDA')
  }

  const resultado = await comercialJourneyRepository.registrarRespostaProposta(
    input.token,
    input.decisao,
    input.nome.trim(),
    input.observacao?.trim() || null
  )

  if (!resultado.ja_respondido) {
    await publicarEvento({
      codigo: input.decisao === 'Aprovado'
        ? ERPEvents.PROPOSTA_ACEITA
        : ERPEvents.PROPOSTA_RECUSADA,
      titulo: `Proposta #${resultado.numero} ${input.decisao === 'Aprovado' ? 'aceita' : 'recusada'}`,
      descricao: 'Resposta registrada pelo cliente no link público.',
      empresaId: resultado.empresa_id,
      entidadeTipo: 'Proposta',
      entidadeId: resultado.id,
      modulo: 'Comercial',
      origem: 'Site',
      status: resultado.status,
      metadados: { numero: resultado.numero }
    })
  }

  return resultado
}

function cpfValido(cpfInformado: string) {
  const cpf = cpfInformado.replace(/\D/g, '')
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false

  const digito = (tamanho: number) => {
    let soma = 0
    for (let indice = 0; indice < tamanho; indice += 1) {
      soma += Number(cpf[indice]) * (tamanho + 1 - indice)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10])
}

export async function completarDadosClienteProposta(input: {
  token: string
  cpf: string
  endereco: string
  bairro: string
  cidade: string
  email?: string | null
}) {
  if (!cpfValido(input.cpf)) {
    throw new JornadaComercialError('Informe um CPF válido.', 'CPF_INVALIDO')
  }

  for (const [campo, valor] of [
    ['endereço', input.endereco],
    ['bairro', input.bairro],
    ['cidade', input.cidade]
  ] as const) {
    if (valor.trim().length < 2 || valor.trim().length > 300) {
      throw new JornadaComercialError(
        `Informe ${campo} corretamente.`,
        'DADOS_CLIENTE_INVALIDOS'
      )
    }
  }

  if (input.email && (
    input.email.trim().length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
  )) {
    throw new JornadaComercialError('Informe um e-mail válido.', 'EMAIL_INVALIDO')
  }

  const resultado = await comercialJourneyRepository.completarDadosClienteProposta({
    token: input.token,
    cpf: input.cpf.replace(/\D/g, ''),
    endereco: input.endereco.trim(),
    bairro: input.bairro.trim(),
    cidade: input.cidade.trim(),
    email: input.email?.trim().toLowerCase() || null
  })

  if (!resultado.ja_completo) {
    await publicarEvento({
      codigo: ERPEvents.CLIENTE_DADOS_COMPLETOS,
      titulo: `Dados cadastrais da proposta #${resultado.numero} concluídos`,
      descricao: 'Cliente concluiu os dados necessários para o contrato.',
      empresaId: resultado.empresa_id,
      entidadeTipo: 'Proposta',
      entidadeId: resultado.orcamento_id,
      modulo: 'Comercial',
      origem: 'Site',
      status: resultado.status,
      metadados: { numero: resultado.numero }
    })
  }

  return resultado
}

export async function enviarProposta(input: {
  usuarioId: string
  empresaId: string
  orcamentoId: string
}) {
  const resultado = await comercialJourneyRepository.enviarProposta(input)
  if (resultado.ja_enviada) return { ...resultado, avisos: [] }

  const [eventoProposta, eventoPreReserva] = await Promise.all([
    publicarEvento({
      codigo: ERPEvents.PROPOSTA_ENVIADA,
      titulo: `Proposta #${resultado.numero} enviada`,
      descricao: 'Proposta disponibilizada ao cliente para aceite.',
      empresaId: input.empresaId,
      entidadeTipo: 'Proposta',
      entidadeId: resultado.id,
      modulo: 'Comercial',
      origem: 'ERP',
      status: resultado.status,
      usuarioId: input.usuarioId,
      metadados: { numero: resultado.numero }
    }),
    publicarEvento({
      codigo: ERPEvents.PRE_RESERVA_CONVERTIDA_EM_PROPOSTA,
      titulo: `Pré-reserva convertida na proposta #${resultado.numero}`,
      empresaId: input.empresaId,
      entidadeTipo: 'PreReserva',
      entidadeId: resultado.oportunidade_id,
      modulo: 'Comercial',
      origem: 'ERP',
      status: 'CONVERTIDA_EM_PROPOSTA',
      usuarioId: input.usuarioId,
      metadados: { propostaId: resultado.id, numero: resultado.numero }
    })
  ])

  return {
    ...resultado,
    avisos: [
      ...avisosDoEvento(eventoProposta),
      ...avisosDoEvento(eventoPreReserva)
    ]
  }
}

export async function cancelarEnvioProposta(input: {
  usuarioId: string
  empresaId: string
  orcamentoId: string
}) {
  const resultado = await comercialJourneyRepository.cancelarEnvioProposta(input)
  const evento = await publicarEvento({
    codigo: ERPEvents.PROPOSTA_ENVIO_CANCELADO,
    titulo: `Envio da proposta #${resultado.numero} cancelado`,
    descricao: 'O link público anterior foi invalidado para permitir correções.',
    empresaId: input.empresaId,
    entidadeTipo: 'Proposta',
    entidadeId: resultado.id,
    modulo: 'Comercial',
    origem: 'ERP',
    status: resultado.status,
    usuarioId: input.usuarioId,
    metadados: { numero: resultado.numero }
  })

  return { ...resultado, avisos: avisosDoEvento(evento) }
}
