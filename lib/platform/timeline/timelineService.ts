import { supabaseServer } from '@/lib/supabaseServer'
import type { ERPEvent } from '@/lib/events/types'

export async function registrarTimelineGlobal(evento: ERPEvent) {
  const { data, error } = await supabaseServer
    .from('timeline_global')
    .insert({
      empresa_id: evento.empresaId || null,
      reserva_id: evento.reservaId || null,

      entidade_tipo: evento.entidadeTipo,
      entidade_id: evento.entidadeId || null,

      evento_codigo: evento.codigo,
      titulo: evento.titulo,
      descricao: evento.descricao || null,

      modulo: evento.modulo,
      origem: evento.origem || 'ERP',
      status: evento.status || 'Registrado',

      usuario_id: evento.usuarioId || null,
      metadados: evento.metadados || {}
    })
    .select('id')
    .single()

  if (error) throw error

  return data
}
