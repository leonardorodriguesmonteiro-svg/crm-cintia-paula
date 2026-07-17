import { supabaseServer } from '@/lib/supabaseServer'

export const missionRepository = {
  async buscarOrdemCompleta(ordemServicoId: string) {
    const { data, error } = await supabaseServer
      .from('ordens_servico')
      .select(`
        id,
        reserva_id,
        numero,
        status,
        etapa_atual,
        data_prevista,
        iniciada_em,
        concluida_em,
        reservas (
          id,
          data_evento,
          horario_evento,
          endereco_evento,
          clientes (nome),
          kits (nome)
        ),
        ordem_servico_itens (
          id,
          etapa,
          descricao,
          concluido,
          obrigatoria,
          created_at
        ),
        ordem_servico_equipe (
          id,
          funcao_na_os,
          horario_inicio,
          horario_fim,
          equipe (
            id,
            nome,
            funcao
          )
        )
      `)
      .eq('id', ordemServicoId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async buscarTimeline(reservaId: string) {
    const { data, error } = await supabaseServer
      .from('timeline_global')
      .select('id,titulo,descricao,modulo,created_at')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return data || []
  }
}
