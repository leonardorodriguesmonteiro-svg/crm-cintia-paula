type Score = {
  geral: number
  financeiro: number
  juridico: number
  operacao: number
  workflow: number
}

function classificacao(nota: number) {
  if (nota >= 85) return 'Excelente'
  if (nota >= 70) return 'Boa'
  if (nota >= 50) return 'Atenção'
  return 'Crítica'
}

export function SaudeOperacional({ score }: { score: Score }) {
  const itens = [
    ['Financeiro', score.financeiro],
    ['Jurídico', score.juridico],
    ['Operação', score.operacao],
    ['Workflow', score.workflow]
  ] as const

  return (
    <div className="rounded-3xl border bg-white p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">
            SAÚDE OPERACIONAL
          </p>
          <h2 className="text-xl font-bold text-slate-900">
            {score.geral}/100
          </h2>
          <p className="text-sm text-slate-500">
            Situação geral: {classificacao(score.geral)}
          </p>
        </div>

        <div className="h-20 w-20 rounded-full border-8 border-pink-100 flex items-center justify-center">
          <span className="text-xl font-bold text-pink-700">
            {score.geral}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {itens.map(([nome, nota]) => (
          <div key={nome} className="rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">{nome}</p>
              <p className="font-bold text-slate-900">{nota}</p>
            </div>

            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-pink-600"
                style={{ width: `${nota}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
