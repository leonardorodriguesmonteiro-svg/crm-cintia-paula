import { Button } from '@/components/ui/Button'

export function MissionProgress({
  progresso,
  onAtualizar
}: {
  progresso: number
  onAtualizar: () => void
}) {
  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            Progresso da missão
          </p>

          <p className="text-2xl font-bold text-slate-900">
            {progresso}%
          </p>
        </div>

        <Button variant="secondary" onClick={onAtualizar}>
          Atualizar
        </Button>
      </div>

      <div className="mt-4 h-4 rounded-full bg-slate-100">
        <div
          className="h-4 rounded-full bg-pink-600 transition-all"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </section>
  )
}
