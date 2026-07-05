export type WorkflowEventType =
  | 'RESERVA_CONFIRMADA'
  | 'PAGAMENTO_REGISTRADO'
  | 'CONTRATO_GERADO'
  | 'OS_CRIADA'

export type WorkflowActionStatus = 'Pendente' | 'Executada' | 'Erro'

export type WorkflowContext = {
  reservaId: string
  evento: WorkflowEventType
  titulo: string
  descricao?: string
}
