import { supabaseServer } from '@/lib/supabaseServer'
import { executarWorkflow } from '@/lib/workflow/engine'

export async function confirmarReserva(reservaId: string) {
  const { data: reserva, error } = await supabaseServer
    .from('reservas')
    .update({
      status: 'Confirmada',
      status_comercial: 'Confirmada',
      status_operacional: 'Aguardando operação'
    })
    .eq('id', reservaId)
    .select('id')
    .single()

  if (error) throw error

  await executarWorkflow({
    reservaId: reserva.id,
    evento: 'RESERVA_CONFIRMADA',
    titulo: 'Reserva confirmada',
    descricao: 'A reserva foi confirmada e o fluxo automático foi iniciado.'
  })

  return reserva
}
