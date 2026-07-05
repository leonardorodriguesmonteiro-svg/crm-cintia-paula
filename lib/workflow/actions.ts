import { supabaseServer } from '@/lib/supabaseServer'

export async function criarContratoSeNaoExistir(reservaId: string) {
  const existente = await supabaseServer
    .from('contratos')
    .select('id')
    .eq('reserva_id', reservaId)
    .maybeSingle()

  if (existente.data) return

  const numero = `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

  const { error } = await supabaseServer.from('contratos').insert({
    reserva_id: reservaId,
    numero_contrato: numero,
    status: 'Gerado',
    observacoes: 'Contrato criado automaticamente pelo Workflow.'
  })

  if (error) throw error
}

export async function criarOSSeNaoExistir(reservaId: string) {
  const existente = await supabaseServer
    .from('ordens_servico')
    .select('id')
    .eq('reserva_id', reservaId)
    .maybeSingle()

  if (existente.data) return

  const numero = `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

  const { data, error } = await supabaseServer
    .from('ordens_servico')
    .insert({
      reserva_id: reservaId,
      numero,
      status: 'Aberta'
    })
    .select('id')
    .single()

  if (error) throw error

  const tarefas = [
    ['Separação', 'Separar todos os itens do kit'],
    ['Separação', 'Conferir composição do kit'],
    ['Entrega', 'Carregar itens para transporte'],
    ['Entrega', 'Confirmar entrega ao cliente'],
    ['Devolução', 'Conferir itens devolvidos'],
    ['Encerramento', 'Finalizar ordem de serviço']
  ]

  await supabaseServer.from('ordem_servico_itens').insert(
    tarefas.map(([etapa, descricao]) => ({
      ordem_servico_id: data.id,
      etapa,
      descricao,
      concluido: false
    }))
  )
}

export async function registrarTimeline(reservaId: string, titulo: string, descricao: string, tipo = 'Workflow') {
  await supabaseServer.from('reserva_timeline').insert({
    reserva_id: reservaId,
    titulo,
    descricao,
    tipo
  })
}
