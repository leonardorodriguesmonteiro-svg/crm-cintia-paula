import { supabaseServer } from '@/lib/supabaseServer'
import { contratoRepository } from '@/lib/repositories/contratoRepository'
import { ordemServicoRepository } from '@/lib/repositories/ordemServicoRepository'

export async function criarContratoSeNaoExistir(reservaId: string) {
  const existente = await contratoRepository.buscarPorReserva(reservaId)

  if (existente) return existente

  return contratoRepository.criarAutomatico(reservaId)
}

export async function criarOSSeNaoExistir(reservaId: string) {
  const existente = await ordemServicoRepository.buscarPorReserva(reservaId)

  if (existente) return existente

  const ordem = await ordemServicoRepository.criarAutomaticamente(reservaId)

  await ordemServicoRepository.criarTarefasPadrao(ordem.id)

  return ordem
}

export async function registrarTimeline(
  reservaId: string,
  titulo: string,
  descricao: string,
  tipo = 'Workflow'
) {
  const { error } = await supabaseServer
    .from('reserva_timeline')
    .insert({
      reserva_id: reservaId,
      titulo,
      descricao,
      tipo
    })

  if (error) throw error
}
