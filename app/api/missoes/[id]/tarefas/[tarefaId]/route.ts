import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { publicarEvento } from '@/lib/events/eventBus'
import { ERPEvents } from '@/lib/events/catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string; tarefaId: string }>
  }
) {
  try {
    const { id: missaoId, tarefaId } = await params
    const corpo = await request.json()
    const concluido = Boolean(corpo.concluido)

    const { data: tarefa, error: tarefaError } = await supabaseServer
      .from('ordem_servico_itens')
      .update({
        concluido,
        concluida_em: concluido ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', tarefaId)
      .eq('ordem_servico_id', missaoId)
      .select('id,etapa,descricao,concluido')
      .single()

    if (tarefaError) throw tarefaError

    const { data: missao, error: missaoError } = await supabaseServer
      .from('ordens_servico')
      .select('id,reserva_id')
      .eq('id', missaoId)
      .single()

    if (missaoError) throw missaoError

    const { data: tarefas, error: listaError } = await supabaseServer
      .from('ordem_servico_itens')
      .select('concluido')
      .eq('ordem_servico_id', missaoId)

    if (listaError) throw listaError

    const total = tarefas?.length || 0
    const concluidas =
      tarefas?.filter(item => item.concluido).length || 0

    const progresso = total
      ? Math.round((concluidas / total) * 100)
      : 0

    const status =
      progresso === 100
        ? 'Concluída'
        : progresso > 0
          ? 'Em andamento'
          : 'Aberta'

    await supabaseServer
      .from('ordens_servico')
      .update({
        status,
        concluida_em:
          progresso === 100 ? new Date().toISOString() : null,
        iniciada_em:
          progresso > 0 ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', missaoId)

    await publicarEvento({
      codigo: concluido
        ? ERPEvents.CHECKLIST_CONCLUIDO
        : ERPEvents.OS_CRIADA,
      titulo: concluido
        ? 'Tarefa da missão concluída'
        : 'Tarefa da missão reaberta',
      descricao: `${tarefa.etapa}: ${tarefa.descricao}`,
      reservaId: missao.reserva_id,
      entidadeTipo: 'OrdemServico',
      entidadeId: missaoId,
      modulo: 'Operação',
      origem: 'MissionWorkspace',
      metadados: {
        tarefa_id: tarefa.id,
        concluido,
        progresso,
        status
      }
    })

    return NextResponse.json({
      sucesso: true,
      tarefa,
      progresso,
      status
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: error?.message || 'Erro ao atualizar tarefa.'
      },
      { status: 500 }
    )
  }
}
