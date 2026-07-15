import { supabaseServer } from '@/lib/supabaseServer'

export const ordemServicoRepository = {
  async buscarPorReserva(reservaId: string) {
    const { data, error } = await supabaseServer
      .from('ordens_servico')
      .select('*')
      .eq('reserva_id', reservaId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async criarAutomaticamente(reservaId: string) {
    const numero = `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const { data, error } = await supabaseServer
      .from('ordens_servico')
      .insert({
        reserva_id: reservaId,
        numero,
        status: 'Aberta'
      })
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async criarTarefasPadrao(ordemServicoId: string) {
    const tarefas = [
      ['Separação', 'Separar todos os itens do kit'],
      ['Separação', 'Conferir composição do kit'],
      ['Entrega', 'Carregar itens para transporte'],
      ['Entrega', 'Confirmar entrega ao cliente'],
      ['Devolução', 'Conferir itens devolvidos'],
      ['Encerramento', 'Finalizar ordem de serviço']
    ]

    const { error } = await supabaseServer
      .from('ordem_servico_itens')
      .insert(
        tarefas.map(([etapa, descricao]) => ({
          ordem_servico_id: ordemServicoId,
          etapa,
          descricao,
          concluido: false
        }))
      )

    if (error) throw error
  }
}
