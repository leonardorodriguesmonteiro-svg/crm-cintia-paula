import { calcularOrcamento3, type TipoOrigemItemOrcamento3 } from '../domain/comercial/orcamento3.ts'

export type ItemEditor = {
  chave: string
  kit_id: string
  estoque_item_id: string
  item_conceitual_id: string
  tipo_origem: TipoOrigemItemOrcamento3
  descricao: string
  quantidade: number | string
  valor_unitario: number | string
  preco_base: number | null
  desconto: number | string
  observacao: string
}
export type TaxaEditor = {
  chave: string
  descricao: string
  tipo: string
  valor: number | string
  observacao: string
}
export const tiposTaxa = ['ENTREGA', 'RETIRADA', 'MONTAGEM', 'DESMONTAGEM', 'TRANSPORTE', 'DESLOCAMENTO', 'EXTRA', 'OUTRA'] as const

export function calcularEditor(itens: ItemEditor[], taxas: TaxaEditor[], descontoTipo: 'VALOR' | 'PERCENTUAL', descontoValor: number | string) {
  return calcularOrcamento3({
    itens: itens.map(item => ({ quantidade: Number(item.quantidade), precoUnitarioOrcamento: Number(item.valor_unitario), desconto: Number(item.desconto), tipoOrigem: item.tipo_origem })),
    taxas: taxas.map(taxa => ({ valor: Number(taxa.valor) })),
    descontoTipo, descontoValor: Number(descontoValor)
  })
}

export function serializarEditor(itens: ItemEditor[], taxas: TaxaEditor[]) {
  return {
    itens: itens.map((item, ordem) => ({
      tipo_origem: item.tipo_origem,
      kit_id: item.kit_id || null,
      estoque_item_id: item.estoque_item_id || null,
      item_conceitual_id: item.item_conceitual_id || null,
      descricao: item.descricao.trim(), quantidade: Number(item.quantidade),
      preco_base: item.preco_base,
      preco_unitario_orcamento: Number(item.valor_unitario), desconto: Number(item.desconto),
      observacao: item.observacao.trim() || null, ordem
    })),
    taxas: taxas.map((taxa, ordem) => ({ descricao: taxa.descricao.trim(), tipo: taxa.tipo, valor: Number(taxa.valor), observacao: taxa.observacao.trim() || null, ordem }))
  }
}

export function validarEditor(itens: ItemEditor[], taxas: TaxaEditor[], tipo: 'VALOR' | 'PERCENTUAL', desconto: number | string) {
  if (!itens.length || itens.some(item => !item.descricao.trim())) return 'Preencha a descrição de todos os itens.'
  if (itens.some(item => item.valor_unitario === '' || item.quantidade === '')) return 'Preencha quantidade e preço de todos os itens.'
  if (taxas.some(taxa => !taxa.descricao.trim() || taxa.valor === '')) return 'Preencha a descrição e o valor de todas as taxas.'
  if (itens.length > 100 || taxas.length > 50) return 'Limite de 100 itens ou 50 taxas excedido.'
  if (!calcularEditor(itens, taxas, tipo, desconto).valido) return 'Confira quantidades, preços, descontos e taxas. Os valores devem ser válidos e os descontos não podem ultrapassar o subtotal.'
  return null
}
