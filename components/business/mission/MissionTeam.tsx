import type { MissionViewModel } from '@/lib/application/mission/mission.types'

export function MissionTeam({
  equipe
}: {
  equipe: MissionViewModel['equipe']
}) {
  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">
        Equipe da missão
      </h2>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {equipe.map(pessoa => (
          <div key={pessoa.id} className="rounded-2xl border p-4">
            <p className="font-bold text-slate-900">
              {pessoa.nome}
            </p>

            <p className="text-sm text-slate-500">
              {pessoa.funcao}
            </p>

            <p className="mt-2 text-sm text-slate-600">
              {pessoa.inicio || '-'} até {pessoa.fim || '-'}
            </p>
          </div>
        ))}

        {equipe.length === 0 && (
          <p className="text-sm text-slate-500">
            Nenhum colaborador alocado.
          </p>
        )}
      </div>
    </section>
  )
}
