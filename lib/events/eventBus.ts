import type { ERPEvent, ERPEventListener } from './types'
import { timelineListener } from './listeners/timeline.listener'
import { workflowListener } from './listeners/workflow.listener'

const listenersExtras = new Map<string, ERPEventListener[]>()

const listenersPrincipais: ERPEventListener[] = [
  timelineListener,
  workflowListener
]

export function registrarListener(
  codigoEvento: string,
  listener: ERPEventListener
) {
  const atuais = listenersExtras.get(codigoEvento) || []
  listenersExtras.set(codigoEvento, [...atuais, listener])
}

export async function publicarEvento(evento: ERPEvent) {
  const especificos = listenersExtras.get(evento.codigo) || []
  const globais = listenersExtras.get('*') || []

  const todos = [
    ...listenersPrincipais,
    ...especificos,
    ...globais
  ]

  const erros: string[] = []

  for (const listener of todos) {
    try {
      await listener(evento)
    } catch (error: any) {
      const mensagem =
        error?.message || `Erro ao processar ${evento.codigo}`

      erros.push(mensagem)
      console.error(mensagem)
    }
  }

  return {
    evento,
    sucesso: erros.length === 0,
    erros
  }
}
