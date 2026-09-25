import type {
  StatusPreReserva,
  TipoDescontoPreReserva
} from '@/lib/domain/comercial/jornadaComercial'

export type ItemPreReservaInput =
  | {
      tipo: 'KIT'
      kitId: string
      quantidade: number
      observacoes?: string | null
    }
  | {
      tipo: 'ITEM_ESTOQUE'
      estoqueItemId: string
      quantidade: number
      observacoes?: string | null
    }

export type CriarPreReservaInput = {
  empresaId: string
  usuarioId?: string | null
  clienteId?: string | null
  nomeContato: string
  celular: string
  email?: string | null
  origem?: string | null
  origemExternaId?: string | null
  dataEvento?: string | null
  interesse?: string | null
  itens: ItemPreReservaInput[]
}

export type PreReservaCriada = {
  id: string
  numero: number
  status: StatusPreReserva
  criada: boolean
  avisos: string[]
}

export type TransicionarPreReservaInput = {
  empresaId: string
  oportunidadeId: string
  usuarioId: string
  versaoEsperada: number
  proximoStatus: StatusPreReserva
  observacao?: string | null
}

export type PreReservaTransicionada = {
  id: string
  numero: number
  statusAnterior: StatusPreReserva
  status: StatusPreReserva
  versao: number
  avisos: string[]
}

export type AjustarValoresPreReservaInput = {
  empresaId: string
  oportunidadeId: string
  usuarioId: string
  versaoEsperada: number
  descontoTipo: TipoDescontoPreReserva
  descontoValor: number
}

export type ValoresPreReservaAjustados = {
  id: string
  numero: number
  status: StatusPreReserva
  versao: number
  subtotal: number
  desconto_tipo: TipoDescontoPreReserva
  desconto_valor: number
  desconto_calculado: number
  total: number
  avisos: string[]
}

export type PreReservaPersistida = {
  id: string
  numero: number
  empresa_id: string
  etapa: string
  versao: number
}
