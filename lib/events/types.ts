export type ERPEvent = {
  codigo: string
  titulo: string
  descricao?: string

  empresaId?: string | null
  reservaId?: string | null

  entidadeTipo: string
  entidadeId?: string | null

  modulo: string
  origem?: string
  status?: string

  usuarioId?: string | null
  metadados?: Record<string, unknown>
}

export type ERPEventListener = (
  evento: ERPEvent
) => Promise<void>
