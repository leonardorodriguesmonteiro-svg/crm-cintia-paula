import type { WorkflowContext } from './types'
import { registrarWorkflowEvento, registrarWorkflowAcao } from './audit'
import { criarContratoSeNaoExistir, criarOSSeNaoExistir, registrarTimeline } from './actions'

export async function executarWorkflow(contexto: WorkflowContext) {
  const eventoId = await registrarWorkflowEvento(contexto)

  if (contexto.evento === 'RESERVA_CONFIRMADA') {
    try {
      await criarContratoSeNaoExistir(contexto.reservaId)
      await registrarWorkflowAcao(contexto.reservaId, eventoId, 'Jurídico', 'Criar contrato', 'Executada')
    } catch (error: any) {
      await registrarWorkflowAcao(contexto.reservaId, eventoId, 'Jurídico', 'Criar contrato', 'Erro', error.message)
    }

    try {
      await criarOSSeNaoExistir(contexto.reservaId)
      await registrarWorkflowAcao(contexto.reservaId, eventoId, 'Operação', 'Criar ordem de serviço', 'Executada')
    } catch (error: any) {
      await registrarWorkflowAcao(contexto.reservaId, eventoId, 'Operação', 'Criar ordem de serviço', 'Erro', error.message)
    }

    await registrarTimeline(
      contexto.reservaId,
      'Workflow executado',
      'Contrato e Ordem de Serviço processados automaticamente.'
    )
  }
}
