import { supabaseServer } from '@/lib/supabaseServer'

export const reservaRepository = {
  async confirmar(reservaId: string) {
    const { data, error } = await supabaseServer
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

    return data
  },

  async buscarPorId(reservaId: string) {
    const { data, error } = await supabaseServer
      .from('reservas')
      .select('*')
      .eq('id', reservaId)
      .maybeSingle()

    if (error) throw error

    return data
  }
}
