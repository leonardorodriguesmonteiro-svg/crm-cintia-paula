import { supabaseServer } from '@/lib/supabaseServer'

export const contratoRepository = {
  async buscarPorReserva(reservaId: string) {
    const { data, error } = await supabaseServer
      .from('contratos')
      .select('*')
      .eq('reserva_id', reservaId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async criarAutomatico(reservaId: string) {
    const numero = `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const { data, error } = await supabaseServer
      .from('contratos')
      .insert({
        reserva_id: reservaId,
        numero_contrato: numero,
        status: 'Gerado',
        observacoes: 'Contrato criado automaticamente pelo Workflow.'
      })
      .select('*')
      .single()

    if (error) throw error
    return data
  }
}
