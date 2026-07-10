import type { WorkflowContext } from './types'
import { registrarWorkflowEvento } from './audit'
import { executarRegras } from './ruleEngine'

export async function executarWorkflow(contexto: WorkflowContext) {
  const eventoId = await registrarWorkflowEvento(contexto)

  await executarRegras(
    contexto.reservaId,
    eventoId,
    contexto.evento
  )
}
