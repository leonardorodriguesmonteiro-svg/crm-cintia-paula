import type { MissionViewModel } from '@/lib/application/mission/mission.types'

type Tarefa = MissionViewModel['checklist'][number]

export function MissionChecklist({
  checklist,
  atualizandoTarefa,
  onAlternar
}: {
  checklist: MissionViewModel['checklist']
  atualizandoTarefa: string | null
  onAlternar: (
    tarefaId: string,
    concluidoAtual: boolean
  ) => Promise<void>
}) {
  const etapas = Array.from(
    new Set(checklist.map(item => item.etapa))
  )

  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        Checklist operacional
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Toque em uma tarefa para concluir ou reabrir.
      </p>

      <div className="mt-5 space-y-5">
        {etapas.map(etapa => {
          const tarefas = checklist.filter(
            item => item.etapa === etapa
          )

          const concluidas = tarefas.filter(
            item => item.concluido
          ).length

          return (
            <div key={etapa} className="rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-900">{etapa}</p>

                <span className="text-sm font-semibold text-slate-500">
                  {concluidas}/{tarefas.length}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {tarefas.map((tarefa: Tarefa) => {
                  const atualizando =
                    atualizandoTarefa === tarefa.id

                  return (
                    <button
                      key={tarefa.id}
                      type="button"
                      disabled={atualizando}
                      onClick={() =>
                        onAlternar(
                          tarefa.id,
                          tarefa.concluido
                        )
                      }
                      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                        tarefa.concluido
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'bg-slate-50 text-slate-700 hover:border-pink-300 hover:bg-pink-50'
                      } disabled:cursor-wait disabled:opacity-60`}
                    >
                      {atualizando
                        ? 'Atualizando...'
                        : tarefa.concluido
                          ? '✓'
                          : '○'}{' '}
                      {tarefa.descricao}

                      {tarefa.obrigatoria &&
                        !tarefa.concluido &&
                        !atualizando && (
                          <span className="ml-2 text-xs font-semibold text-red-600">
                            Obrigatória
                          </span>
                        )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
