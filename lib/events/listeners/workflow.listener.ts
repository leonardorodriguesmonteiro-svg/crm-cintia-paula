import type { ERPEventListener } from '../types'
import { ERPEvents } from '../catalog'
import { executarWorkflow } from '@/lib/workflow/engine'

export const workflowListener: ERPEventListener = async evento => {
  if (!evento.reservaId) return

  if (evento.codigo === ERPEvents.RESERVA_CONFIRMADA) {
    await executarWorkflow({
      reservaId: evento.reservaId,
      evento: 'RESERVA_CONFIRMADA',
      titulo: evento.titulo,
      descricao: evento.descricao
    })
  }
}
