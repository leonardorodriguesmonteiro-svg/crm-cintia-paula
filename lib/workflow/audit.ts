import { supabaseServer } from '@/lib/supabaseServer'
import type { WorkflowContext } from './types'

export async function registrarWorkflowEvento(contexto: WorkflowContext) {
  const { data, error } = await supabaseServer
    .from('workflow_eventos')
    .insert({
      reserva_id: contexto.reservaId,
      tipo: contexto.evento,
      titulo: contexto.titulo,
      descricao: contexto.descricao || null,
      origem: 'Workflow Engine'
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function registrarWorkflowAcao(
  reservaId: string,
  eventoId: string,
  modulo: string,
  acao: string,
  status: 'Pendente' | 'Executada' | 'Erro',
  erro?: string
) {
  await supabaseServer.from('workflow_acoes').insert({
    reserva_id: reservaId,
    evento_id: eventoId,
    modulo,
    acao,
    status,
    executado_em: status === 'Executada' ? new Date().toISOString() : null,
    erro: erro || null
  })
}
