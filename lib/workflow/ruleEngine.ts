import { supabaseServer } from '@/lib/supabaseServer'
import { avaliarCondicao } from './conditions'
import { executarAcao } from './registry'
import { registrarWorkflowAcao } from './audit'

type RegraWorkflow = {
  id: string
  evento: string
  nome: string
  modulo: string
  acao: string
  condicao: string | null
  ordem: number | null
  ativo: boolean
}

export async function executarRegras(
  reservaId: string,
  eventoId: string,
  evento: string
) {
  const { data, error } = await supabaseServer
    .from('workflow_regras')
    .select('id,evento,nome,modulo,acao,condicao,ordem,ativo')
    .eq('evento', evento)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (error) throw error

  const regras = (data || []) as RegraWorkflow[]

  for (const regra of regras) {
    const podeExecutar = avaliarCondicao(regra.condicao)

    if (!podeExecutar) {
      await registrarWorkflowAcao(
        reservaId,
        eventoId,
        regra.modulo,
        regra.acao,
        'Pendente',
        `Condição não atendida: ${regra.condicao}`
      )
      continue
    }

    try {
      await executarAcao(regra.acao, {
        reservaId,
        evento,
        nomeRegra: regra.nome
      })

      await registrarWorkflowAcao(
        reservaId,
        eventoId,
        regra.modulo,
        regra.acao,
        'Executada'
      )
    } catch (error: any) {
      await registrarWorkflowAcao(
        reservaId,
        eventoId,
        regra.modulo,
        regra.acao,
        'Erro',
        error?.message || 'Erro desconhecido'
      )
    }
  }
}
