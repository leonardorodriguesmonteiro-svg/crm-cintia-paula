import {
  calcularOrcamento3,
  statusOrcamento3,
  type StatusOrcamento3
} from '../../domain/comercial/orcamento3.ts'
import { ERPEvents, type ERPEventCode } from '../../events/catalog.ts'
import type { ERPEvent } from '../../events/types.ts'
import type {
  Orcamento3Persistido,
  Orcamento3Salvo,
  SalvarOrcamento3Input
} from './orcamento3.types.ts'

export class Orcamento3Error extends Error {
  readonly codigo: string
  readonly statusHttp: number

  constructor(
    message: string,
    codigo: string,
    statusHttp = 400
  ) {
    super(message)
    this.name = 'Orcamento3Error'
    this.codigo = codigo
    this.statusHttp = statusHttp
  }
}

type DependenciasOrcamento3 = {
  salvar: (input: SalvarOrcamento3Input) => Promise<Orcamento3Persistido>
  publicar: (evento: ERPEvent) => Promise<{
    sucesso: boolean
    erros: string[]
  }>
}

const uuidValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function dataValida(valor?: string | null) {
  if (!valor) return true
  return /^\d{4}-\d{2}-\d{2}$/.test(valor)
    && !Number.isNaN(Date.parse(`${valor}T12:00:00Z`))
}

function validar(input: SalvarOrcamento3Input) {
  if (!uuidValido.test(input.empresaId) || !uuidValido.test(input.usuarioId)) {
    throw new Orcamento3Error('Empresa ou usuário inválido.', 'IDENTIDADE_INVALIDA')
  }

  if (input.oportunidadeId && !uuidValido.test(input.oportunidadeId)) {
    throw new Orcamento3Error('Solicitação inválida.', 'OPORTUNIDADE_INVALIDA')
  }

  if (input.orcamentoId && !uuidValido.test(input.orcamentoId)) {
    throw new Orcamento3Error('Orçamento inválido.', 'ORCAMENTO_INVALIDO')
  }

  if (!input.orcamentoId && !input.idempotencia?.trim()) {
    throw new Orcamento3Error(
      'Informe uma chave de idempotência para criar o orçamento.',
      'IDEMPOTENCIA_OBRIGATORIA'
    )
  }

  if (input.orcamentoId && (!Number.isInteger(input.versaoEsperada) || Number(input.versaoEsperada) < 1)) {
    throw new Orcamento3Error(
      'Informe a versão atual para editar o orçamento.',
      'VERSAO_OBRIGATORIA',
      409
    )
  }

  if (!statusOrcamento3.includes(input.status as StatusOrcamento3)) {
    throw new Orcamento3Error('Status inválido.', 'STATUS_INVALIDO')
  }

  if (input.itens.length > 100 || (input.taxas?.length || 0) > 50) {
    throw new Orcamento3Error('Limite de itens ou taxas excedido.', 'LIMITE_EXCEDIDO')
  }

  if (![input.dataEvento, input.dataRetirada, input.dataDevolucao, input.validade].every(dataValida)) {
    throw new Orcamento3Error('Uma ou mais datas são inválidas.', 'DATA_INVALIDA')
  }

  if (input.contatoEmail) {
    const email = input.contatoEmail.trim()
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Orcamento3Error('E-mail inválido.', 'EMAIL_INVALIDO')
    }
  }

  const referenciasInvalidas = input.itens.some(item => {
    if (!['KIT', 'ESTOQUE', 'LIVRE', 'CONCEITUAL'].includes(item.tipoOrigem)) {
      return true
    }
    const referencias = [item.kitId, item.estoqueItemId, item.itemConceitualId]
      .filter(Boolean) as string[]
    if (referencias.some(id => !uuidValido.test(id))) return true
    if (item.tipoOrigem === 'KIT') return !item.kitId || referencias.length !== 1
    if (item.tipoOrigem === 'ESTOQUE') return !item.estoqueItemId || referencias.length !== 1
    if (item.tipoOrigem === 'CONCEITUAL') return !item.itemConceitualId || referencias.length !== 1
    return referencias.length > 0 || !item.descricao?.trim()
  })

  if (referenciasInvalidas) {
    throw new Orcamento3Error('Um ou mais itens possuem referência inválida.', 'ITEM_INVALIDO')
  }

  if (input.itens.length) {
    const calculo = calcularOrcamento3({
      itens: input.itens.map(item => ({
        quantidade: item.quantidade,
        precoUnitarioOrcamento: item.precoUnitarioOrcamento ?? item.precoBase ?? 0,
        desconto: item.desconto,
        tipoOrigem: item.tipoOrigem
      })),
      taxas: (input.taxas || []).map(taxa => ({ valor: taxa.valor })),
      descontoTipo: input.descontoTipo,
      descontoValor: input.descontoValor
    })
    if (!calculo.valido) {
      throw new Orcamento3Error(
        `Valores inválidos: ${calculo.erros.join(', ')}.`,
        'CALCULO_INVALIDO'
      )
    }
  }

  if (input.status === 'FINALIZADO') {
    const telefone = (input.contatoTelefone || '').replace(/\D/g, '')
    if (
      input.itens.length === 0
      || (input.contatoNome?.trim().length || 0) < 2
      || !/^\d{10,11}$/.test(telefone)
      || !input.dataEvento
    ) {
      throw new Orcamento3Error(
        'Para finalizar, informe cliente, telefone, data e ao menos um item.',
        'DADOS_FINALIZACAO_INCOMPLETOS'
      )
    }
  }
}

function codigoDoEvento(resultado: Orcamento3Persistido): ERPEventCode {
  if (resultado.criado) return ERPEvents.ORCAMENTO_CRIADO
  if (resultado.status === 'FINALIZADO') return ERPEvents.ORCAMENTO_FINALIZADO
  if (resultado.status === 'CANCELADO') return ERPEvents.ORCAMENTO_CANCELADO
  return ERPEvents.ORCAMENTO_EDITADO
}

function erroTraduzido(error: unknown): never {
  const registro = error && typeof error === 'object'
    ? error as { code?: string; message?: string }
    : {}

  if (registro.code === '40001') {
    throw new Orcamento3Error(
      'O orçamento foi alterado por outra sessão. Atualize e tente novamente.',
      'CONFLITO_DE_VERSAO',
      409
    )
  }
  if (registro.code === 'P0002') {
    throw new Orcamento3Error(
      registro.message || 'Orçamento ou item não encontrado.',
      'REGISTRO_NAO_ENCONTRADO',
      404
    )
  }
  if (registro.code === '42501') {
    throw new Orcamento3Error(
      registro.message || 'Acesso negado.',
      'ACESSO_NEGADO',
      403
    )
  }
  throw error
}

export async function salvarOrcamento3(
  input: SalvarOrcamento3Input,
  dependencias: DependenciasOrcamento3
): Promise<Orcamento3Salvo> {
  validar(input)

  let resultado: Orcamento3Persistido
  try {
    resultado = await dependencias.salvar(input)
  } catch (error) {
    erroTraduzido(error)
  }

  if (!resultado.alterado) return { ...resultado, avisos: [] }

  const evento = await dependencias.publicar({
    codigo: codigoDoEvento(resultado),
    titulo: `Orçamento ORC-${String(resultado.numero).padStart(4, '0')} ${resultado.criado ? 'criado' : 'atualizado'}`,
    descricao: 'Orçamento salvo pela Jornada Simplificada 3.0.',
    empresaId: input.empresaId,
    entidadeTipo: 'Orcamento',
    entidadeId: resultado.id,
    modulo: 'Comercial',
    origem: input.origem || 'MANUAL',
    status: resultado.status,
    usuarioId: input.usuarioId,
    metadados: {
      numero: resultado.numero,
      versao: resultado.versao,
      total: resultado.total,
      possuiItemConceitual: resultado.possui_item_conceitual
    }
  })

  return {
    ...resultado,
    avisos: evento.sucesso
      ? []
      : evento.erros.map(erro => `Evento pendente: ${erro}`)
  }
}
