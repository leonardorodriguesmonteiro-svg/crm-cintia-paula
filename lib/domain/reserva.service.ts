import { reservaRepository } from '@/lib/repositories/reservaRepository'
import { publicarEvento } from '@/lib/events/eventBus'
import { ERPEvents } from '@/lib/events/catalog'

export async function confirmarReserva(reservaId: string) {
  const reserva = await reservaRepository.confirmar(reservaId)

  const processamento = await publicarEvento({
    codigo: ERPEvents.RESERVA_CONFIRMADA,
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

  if (!processamento.sucesso) {
    throw new Error(
      `Reserva confirmada, mas houve falha no processamento: ${processamento.erros.join('; ')}`
    )
  }

  return reserva
}
