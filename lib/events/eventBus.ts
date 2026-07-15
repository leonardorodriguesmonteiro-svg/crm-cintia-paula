import type { ERPEvent, ERPEventListener } from './types'
import { registrarTimelineGlobal } from '@/lib/platform/timeline/timelineService'

const listeners = new Map<string, ERPEventListener[]>()

export function registrarListener(
  codigoEvento: string,
  listener: ERPEventListener
) {
  const atuais = listeners.get(codigoEvento) || []
  listeners.set(codigoEvento, [...atuais, listener])
}

export async function publicarEvento(evento: ERPEvent) {
  await registrarTimelineGlobal(evento)

  const listenersEspecificos = listeners.get(evento.codigo) || []
  const listenersGlobais = listeners.get('*') || []

  const todos = [...listenersEspecificos, ...listenersGlobais]

  for (const listener of todos) {
    try {
      await listener(evento)
    } catch (error) {
      console.error(
        `Erro ao processar listener do evento ${evento.codigo}:`,
        error
      )
    }
  }

  return evento
}
