import type { MissionViewModel } from '@/lib/application/mission/mission.types'

export function MissionTimeline({
  timeline
}: {
  timeline: MissionViewModel['timeline']
}) {
  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        Timeline da missão
      </h2>

      <div className="mt-4 space-y-3">
        {timeline.map(item => (
          <div
            key={item.id}
            className="border-l-4 border-pink-200 pl-4"
          >
            <p className="font-semibold text-slate-900">
              {item.titulo}
            </p>

            <p className="text-sm text-slate-500">
              {item.modulo} •{' '}
              {new Date(item.data).toLocaleString('pt-BR')}
            </p>

            {item.descricao && (
              <p className="mt-1 text-sm text-slate-600">
                {item.descricao}
              </p>
            )}
          </div>
        ))}

        {timeline.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhum evento registrado na Timeline Universal.
          </p>
        )}
      </div>
    </section>
  )
}
