import type { MissionViewModel } from '@/lib/application/mission/mission.types'

export function MissionActionCard({
  missao
}: {
  missao: MissionViewModel
}) {
  return (
    <section className="rounded-3xl border border-pink-200 bg-pink-50 p-5 md:p-6">
      <p className="text-sm font-semibold text-pink-700">
        PRÓXIMA AÇÃO
      </p>

      <h2 className="mt-2 text-xl font-bold text-slate-900">
        {missao.proximaAcao.titulo}
      </h2>

      <p className="mt-1 text-sm text-slate-600">
        Etapa: {missao.proximaAcao.etapa}
      </p>
    </section>
  )
}
