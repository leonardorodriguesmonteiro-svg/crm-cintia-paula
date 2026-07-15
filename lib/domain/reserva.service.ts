import { reservaRepository } from '@/lib/repositories/reservaRepository'
import { executarWorkflow } from '@/lib/workflow/engine'
import { publicarEvento } from '@/lib/events/eventBus'

export async function confirmarReserva(reservaId: string) {
  const reserva = await reservaRepository.confirmar(reservaId)

  await publicarEvento({
    codigo: 'RESERVA_CONFIRMADA',
    titulo: 'Reserva confirmada',
    descricao:
      'A reserva foi confirmada e o fluxo automático foi iniciado.',
    reservaId: reserva.id,
    entidadeTipo: 'Reserva',
    entidadeId: reserva.id,
    modulo: 'Comercial',
    origem: 'ReservaService',
    metadados: {
      status_comercial: 'Confirmada',
      status_operacional: 'Aguardando operação'
    }
  })

  await executarWorkflow({
    reservaId: reserva.id,
    evento: 'RESERVA_CONFIRMADA',
    titulo: 'Reserva confirmada',
    descricao:
      'A reserva foi confirmada e o fluxo automático foi iniciado.'
  })

  return reserva
}
