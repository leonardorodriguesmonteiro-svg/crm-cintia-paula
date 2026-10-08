import type {
  StatusOrcamento3,
  TipoDescontoOrcamento3,
  TipoOrigemItemOrcamento3
} from '@/lib/domain/comercial/orcamento3'

export type OrigemOrcamento3 =
  | 'SITE'
  | 'MANUAL'
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'TELEFONE'
  | 'INDICACAO'
  | 'OUTRO'

export type ItemOrcamento3Input = {
  tipoOrigem: TipoOrigemItemOrcamento3
  kitId?: string | null
  estoqueItemId?: string | null
  itemConceitualId?: string | null
  descricao?: string | null
  quantidade: number
  precoBase?: number | null
  precoUnitarioOrcamento?: number | null
  desconto?: number
  observacao?: string | null
  ordem?: number
}

export type TaxaOrcamento3Input = {
  descricao: string
  valor: number
  tipo?:
    | 'ENTREGA'
    | 'RETIRADA'
    | 'MONTAGEM'
    | 'DESMONTAGEM'
    | 'TRANSPORTE'
    | 'DESLOCAMENTO'
    | 'EXTRA'
    | 'OUTRA'
  observacao?: string | null
  ordem?: number
}

export type SalvarOrcamento3Input = {
  empresaId: string
  usuarioId: string
  orcamentoId?: string | null
  versaoEsperada?: number | null
  idempotencia?: string | null
  status: StatusOrcamento3
  origem?: OrigemOrcamento3
  clienteId?: string | null
  contatoNome?: string | null
  contatoTelefone?: string | null
  contatoEmail?: string | null
  temaEvento?: string | null
  dataEvento?: string | null
  horarioEvento?: string | null
  dataRetirada?: string | null
  horarioRetirada?: string | null
  dataDevolucao?: string | null
  enderecoEvento?: string | null
  observacoes?: string | null
  descontoTipo?: TipoDescontoOrcamento3
  descontoValor?: number
  itens: ItemOrcamento3Input[]
  taxas?: TaxaOrcamento3Input[]
}

export type Orcamento3Persistido = {
  id: string
  numero: number
  status_anterior: string | null
  status: StatusOrcamento3
  versao: number
  subtotal: number
  desconto: number
  total_taxas: number
  total: number
  criado: boolean
  alterado: boolean
  possui_item_conceitual: boolean
}

export type Orcamento3Salvo = Orcamento3Persistido & {
  avisos: string[]
}
