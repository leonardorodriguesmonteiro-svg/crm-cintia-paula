import type {
  ItemOrcamento3Input,
  OrigemOrcamento3,
  SalvarOrcamento3Input,
  TaxaOrcamento3Input
} from '@/lib/application/comercial/orcamento3.types'
import type {
  StatusOrcamento3,
  TipoDescontoOrcamento3,
  TipoOrigemItemOrcamento3
} from '@/lib/domain/comercial/orcamento3'

function texto(registro: Record<string, unknown>, chave: string) {
  return typeof registro[chave] === 'string' ? registro[chave] as string : null
}

function numero(registro: Record<string, unknown>, chave: string, padrao = 0) {
  return registro[chave] === null || registro[chave] === undefined
    ? padrao
    : Number(registro[chave])
}

function itemDoCorpo(valor: unknown, indice: number): ItemOrcamento3Input {
  const item = valor && typeof valor === 'object'
    ? valor as Record<string, unknown>
    : {}

  return {
    tipoOrigem: String(item.tipo_origem || '') as TipoOrigemItemOrcamento3,
    kitId: texto(item, 'kit_id'),
    estoqueItemId: texto(item, 'estoque_item_id'),
    itemConceitualId: texto(item, 'item_conceitual_id'),
    descricao: texto(item, 'descricao'),
    quantidade: numero(item, 'quantidade'),
    precoBase: item.preco_base === null || item.preco_base === undefined
      ? null
      : Number(item.preco_base),
    precoUnitarioOrcamento:
      item.preco_unitario_orcamento === null
        || item.preco_unitario_orcamento === undefined
        ? null
        : Number(item.preco_unitario_orcamento),
    desconto: numero(item, 'desconto'),
    observacao: texto(item, 'observacao'),
    ordem: numero(item, 'ordem', indice)
  }
}

function taxaDoCorpo(valor: unknown, indice: number): TaxaOrcamento3Input {
  const taxa = valor && typeof valor === 'object'
    ? valor as Record<string, unknown>
    : {}

  return {
    descricao: String(taxa.descricao || ''),
    valor: numero(taxa, 'valor', Number.NaN),
    tipo: String(taxa.tipo || 'OUTRA') as TaxaOrcamento3Input['tipo'],
    observacao: texto(taxa, 'observacao'),
    ordem: numero(taxa, 'ordem', indice)
  }
}

export function orcamento3DoCorpo(
  corpo: Record<string, unknown>,
  identidade: {
    empresaId: string
    usuarioId: string
    orcamentoId?: string | null
    idempotenciaCabecalho?: string | null
  }
): SalvarOrcamento3Input {
  return {
    empresaId: identidade.empresaId,
    usuarioId: identidade.usuarioId,
    orcamentoId: identidade.orcamentoId || null,
    versaoEsperada: corpo.versao === null || corpo.versao === undefined
      ? null
      : Number(corpo.versao),
    idempotencia: identidade.idempotenciaCabecalho
      || texto(corpo, 'idempotencia'),
    status: String(corpo.status || 'NOVO') as StatusOrcamento3,
    origem: String(corpo.origem || 'MANUAL') as OrigemOrcamento3,
    clienteId: texto(corpo, 'cliente_id'),
    contatoNome: texto(corpo, 'contato_nome'),
    contatoTelefone: texto(corpo, 'contato_telefone'),
    contatoEmail: texto(corpo, 'contato_email'),
    temaEvento: texto(corpo, 'tema_evento'),
    dataEvento: texto(corpo, 'data_evento'),
    horarioEvento: texto(corpo, 'horario_evento'),
    dataRetirada: texto(corpo, 'data_retirada'),
    horarioRetirada: texto(corpo, 'horario_retirada'),
    dataDevolucao: texto(corpo, 'data_devolucao'),
    enderecoEvento: texto(corpo, 'endereco_evento'),
    observacoes: texto(corpo, 'observacoes'),
    descontoTipo: String(corpo.desconto_tipo || 'VALOR') as TipoDescontoOrcamento3,
    descontoValor: numero(corpo, 'desconto_valor'),
    itens: Array.isArray(corpo.itens)
      ? corpo.itens.map(itemDoCorpo)
      : [],
    taxas: Array.isArray(corpo.taxas)
      ? corpo.taxas.map(taxaDoCorpo)
      : []
  }
}
