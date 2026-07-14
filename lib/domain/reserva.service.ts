import { reservaRepository } from '@/lib/repositories/reservaRepository'
import { executarWorkflow } from '@/lib/workflow/engine'

export async function confirmarReserva(reservaId: string) {
  const reserva = await reservaRepository.confirmar(reservaId)

  await executarWorkflow({
    reservaId: reserva.id,
    evento: 'RESERVA_CONFIRMADA',
    titulo: 'Reserva confirmada',
    descricao:
      'A reserva foi confirmada e o fluxo automático foi iniciado.'
  })

  return reserva
}
