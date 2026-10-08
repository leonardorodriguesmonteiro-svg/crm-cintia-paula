export const statusOrcamento3 = [
  'NOVO',
  'EM_EDICAO',
  'FINALIZADO',
  'CANCELADO'
] as const

export type StatusOrcamento3 = (typeof statusOrcamento3)[number]
export type TipoDescontoOrcamento3 = 'VALOR' | 'PERCENTUAL'
export type TipoOrigemItemOrcamento3 = 'KIT' | 'ESTOQUE' | 'LIVRE' | 'CONCEITUAL'

export type ItemCalculoOrcamento3 = {
  quantidade: number
  precoUnitarioOrcamento: number
  desconto?: number
  tipoOrigem?: TipoOrigemItemOrcamento3
}

export type TaxaCalculoOrcamento3 = {
  valor: number
}

export type CalculoOrcamento3Input = {
  itens: readonly ItemCalculoOrcamento3[]
  taxas?: readonly TaxaCalculoOrcamento3[]
  descontoTipo?: TipoDescontoOrcamento3
  descontoValor?: number
}

export type CalculoOrcamento3 = {
  valido: boolean
  erros: string[]
  subtotal: number
  descontoCalculado: number
  totalTaxas: number
  totalFinal: number
  possuiItemConceitual: boolean
}

const transicoesOrcamento3: Record<StatusOrcamento3, readonly StatusOrcamento3[]> = {
  NOVO: ['EM_EDICAO', 'CANCELADO'],
  EM_EDICAO: ['FINALIZADO', 'CANCELADO'],
  FINALIZADO: ['EM_EDICAO', 'CANCELADO'],
  CANCELADO: []
}

function dinheiroEmCentavos(valor: number) {
  return Math.round(valor * 100)
}

function centavosEmDinheiro(valor: number) {
  return Math.round(valor) / 100
}

export function podeTransicionarOrcamento3(
  atual: StatusOrcamento3,
  proximo: StatusOrcamento3
) {
  return transicoesOrcamento3[atual].includes(proximo)
}

export function calcularOrcamento3(
  input: CalculoOrcamento3Input
): CalculoOrcamento3 {
  const erros: string[] = []
  const descontoTipo = input.descontoTipo ?? 'VALOR'
  const descontoValor = Number(input.descontoValor ?? 0)

  if (input.itens.length === 0) erros.push('ORCAMENTO_SEM_ITENS')
  if (descontoTipo !== 'VALOR' && descontoTipo !== 'PERCENTUAL') {
    erros.push('TIPO_DESCONTO_INVALIDO')
  }
  if (!Number.isFinite(descontoValor) || descontoValor < 0) {
    erros.push('DESCONTO_INVALIDO')
  }
  if (descontoTipo === 'PERCENTUAL' && descontoValor > 100) {
    erros.push('PERCENTUAL_DESCONTO_INVALIDO')
  }

  let subtotalCentavos = 0
  let totalTaxasCentavos = 0

  input.itens.forEach((item, indice) => {
    const quantidade = Number(item.quantidade)
    const preco = Number(item.precoUnitarioOrcamento)
    const descontoItem = Number(item.desconto ?? 0)

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      erros.push(`ITEM_${indice + 1}_QUANTIDADE_INVALIDA`)
      return
    }
    if (!Number.isFinite(preco) || preco < 0) {
      erros.push(`ITEM_${indice + 1}_PRECO_INVALIDO`)
      return
    }
    if (!Number.isFinite(descontoItem) || descontoItem < 0) {
      erros.push(`ITEM_${indice + 1}_DESCONTO_INVALIDO`)
      return
    }

    const brutoCentavos = Math.round(quantidade * dinheiroEmCentavos(preco))
    const descontoItemCentavos = dinheiroEmCentavos(descontoItem)
    if (descontoItemCentavos > brutoCentavos) {
      erros.push(`ITEM_${indice + 1}_DESCONTO_MAIOR_QUE_SUBTOTAL`)
      return
    }
    subtotalCentavos += brutoCentavos - descontoItemCentavos
  })

  ;(input.taxas ?? []).forEach((taxa, indice) => {
    const valor = Number(taxa.valor)
    if (!Number.isFinite(valor) || valor < 0) {
      erros.push(`TAXA_${indice + 1}_VALOR_INVALIDO`)
      return
    }
    totalTaxasCentavos += dinheiroEmCentavos(valor)
  })

  const descontoCalculadoCentavos = descontoTipo === 'PERCENTUAL'
    ? Math.round(subtotalCentavos * descontoValor / 100)
    : dinheiroEmCentavos(Number.isFinite(descontoValor) ? descontoValor : 0)

  if (descontoCalculadoCentavos > subtotalCentavos) {
    erros.push('DESCONTO_MAIOR_QUE_SUBTOTAL')
  }

  const descontoSeguroCentavos = Math.min(
    Math.max(descontoCalculadoCentavos, 0),
    subtotalCentavos
  )
  const totalFinalCentavos = Math.max(
    subtotalCentavos - descontoSeguroCentavos + totalTaxasCentavos,
    0
  )

  return {
    valido: erros.length === 0,
    erros,
    subtotal: centavosEmDinheiro(subtotalCentavos),
    descontoCalculado: centavosEmDinheiro(descontoSeguroCentavos),
    totalTaxas: centavosEmDinheiro(totalTaxasCentavos),
    totalFinal: centavosEmDinheiro(totalFinalCentavos),
    possuiItemConceitual: input.itens.some(item => item.tipoOrigem === 'CONCEITUAL')
  }
}
