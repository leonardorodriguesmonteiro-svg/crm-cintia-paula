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
    const { data: reserva, error: reservaError } = await supabaseServer
      .from('reservas')
      .select('id,cliente_id,data_retirada,horario_retirada,data_evento')
      .eq('id', reservaId)
      .maybeSingle()

    if (reservaError) throw reservaError
    if (!reserva) throw new Error('Reserva não encontrada para criação da Ordem de Serviço.')

    let clienteNome: string | null = null
    if (reserva.cliente_id) {
      const { data: cliente, error: clienteError } = await supabaseServer
        .from('clientes')
        .select('nome')
        .eq('id', reserva.cliente_id)
        .maybeSingle()

      if (clienteError) throw clienteError
      clienteNome = cliente?.nome || null
    }

    const dataRetirada = reserva.data_retirada || reserva.data_evento || null
    const numero = `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const { data, error } = await supabaseServer
      .from('ordens_servico')
      .insert({
        reserva_id: reservaId,
        numero,
        status: 'Aberta',
        cliente_nome: clienteNome,
        data_retirada: dataRetirada,
        horario_retirada: reserva.horario_retirada || null,
        // Mantemos data_prevista por compatibilidade com telas e relatórios legados.
        data_prevista: dataRetirada
      })
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async criarTarefasPadrao(ordemServicoId: string) {
    const tarefas = [
      ['Separação', 'Separar todos os itens da reserva'],
      ['Separação', 'Conferir KIT pronto ou composição do KIT personalizado'],
      ['Retirada', 'Confirmar entrega dos itens ao cliente ou responsável pela retirada'],
      ['Entrega', 'Carregar itens para transporte quando houver entrega'],
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
