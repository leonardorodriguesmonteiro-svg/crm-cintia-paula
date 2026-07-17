import type { MissionViewModel } from '@/lib/application/mission/mission.types'

export function MissionHeader({
  missao
}: {
  missao: MissionViewModel
}) {
  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">
            MISSÃO {missao.numero}
          </p>

          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {missao.evento.cliente}
          </h1>

          <p className="text-slate-500">{missao.evento.kit}</p>
        </div>

        <span className="w-fit rounded-full bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700">
          {missao.status}
        </span>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-slate-500">Data</p>
          <p className="font-semibold text-slate-900">
            {missao.evento.data || '-'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-slate-500">Horário</p>
          <p className="font-semibold text-slate-900">
            {missao.evento.horario || '-'}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-slate-500">Etapa atual</p>
          <p className="font-semibold text-slate-900">
            {missao.etapaAtual}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        <strong>Endereço:</strong> {missao.evento.endereco || '-'}
      </p>
    </section>
  )
}
