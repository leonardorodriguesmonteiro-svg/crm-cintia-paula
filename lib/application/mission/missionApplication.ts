import { missionRepository } from '@/lib/repositories/missionRepository'
import type { MissionViewModel } from './mission.types'

export async function obterMissao(
  ordemServicoId: string
): Promise<MissionViewModel> {
  const ordem: any =
    await missionRepository.buscarOrdemCompleta(ordemServicoId)

  if (!ordem) {
    throw new Error('Missão não encontrada.')
  }

  const tarefas = [...(ordem.ordem_servico_itens || [])].sort(
    (a: any, b: any) =>
      String(a.created_at).localeCompare(String(b.created_at))
  )

  const concluidas = tarefas.filter(
    (item: any) => item.concluido
  ).length

  const progresso = tarefas.length
    ? Math.round((concluidas / tarefas.length) * 100)
    : 0

  const proximaTarefa =
    tarefas.find(
      (item: any) =>
        !item.concluido &&
        item.etapa === (ordem.etapa_atual || 'Separação')
    ) ||
    tarefas.find((item: any) => !item.concluido)

  const [timeline, evidencias, assinaturas] = await Promise.all([
    missionRepository.buscarTimeline(ordem.reserva_id),
    missionRepository.buscarEvidencias(ordem.id),
    missionRepository.buscarAssinaturas(ordem.id)
  ])

  return {
    id: ordem.id,
    reservaId: ordem.reserva_id,
    numero: ordem.numero,
    status: ordem.status || 'Aberta',
    etapaAtual: ordem.etapa_atual || 'Separação',
    progresso,

    evento: {
      data: ordem.reservas?.data_evento || null,
      horario: ordem.reservas?.horario_evento || null,
      endereco: ordem.reservas?.endereco_evento || null,
      cliente:
        ordem.reservas?.clientes?.nome ||
        'Cliente não informado',
      kit:
        ordem.reservas?.kits?.nome ||
        'Kit não informado'
    },

    equipe: (ordem.ordem_servico_equipe || []).map(
      (item: any) => ({
        id: item.equipe?.id || item.id,
        nome: item.equipe?.nome || 'Colaborador',
        funcao:
          item.funcao_na_os ||
          item.equipe?.funcao ||
          'Não definida',
        inicio: item.horario_inicio || null,
        fim: item.horario_fim || null
      })
    ),

    checklist: tarefas.map((item: any) => ({
      id: item.id,
      etapa: item.etapa,
      descricao: item.descricao,
      concluido: Boolean(item.concluido),
      obrigatoria: item.obrigatoria !== false
    })),

    proximaAcao: {
      tarefaId: proximaTarefa?.id || null,
      titulo:
        proximaTarefa?.descricao ||
        'Todas as tarefas foram concluídas.',
      etapa:
        proximaTarefa?.etapa ||
        'Encerramento'
    },

    timeline: timeline.map((item: any) => ({
      id: item.id,
      titulo: item.titulo,
      descricao: item.descricao,
      modulo: item.modulo,
      data: item.created_at
    })),

    evidencias: evidencias.map((item: any) => ({
      id: item.id,
      tipo: item.tipo,
      etapa: item.etapa,
      titulo: item.titulo,
      descricao: item.descricao,
      url: item.signed_url,
      mimeType: item.mime_type,
      tamanhoBytes: Number(item.tamanho_bytes || 0),
      capturadaEm: item.capturada_em,
      autor: item.autor
    })),

    assinaturas: assinaturas.map((item: any) => ({
      id: item.id,
      etapa: item.etapa,
      nomeAssinante: item.nome_assinante,
      assinadaEm: item.assinada_em,
      url: item.signed_url,
      registradaPor: item.autor
    }))
  }
}
