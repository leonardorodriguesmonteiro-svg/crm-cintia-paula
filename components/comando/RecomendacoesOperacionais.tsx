import Link from 'next/link'
import type { Recomendacao } from '@/lib/services/inteligencia/recommendationService'

export function RecomendacoesOperacionais({
  recomendacoes
}: {
  recomendacoes: Recomendacao[]
}) {
  const estiloPrioridade = {
    Alta: 'border-red-200 bg-red-50 text-red-800',
    Média: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    Baixa: 'border-green-200 bg-green-50 text-green-800'
  }

  return (
    <div className="rounded-3xl border bg-white p-5 md:p-6">
      <div>
        <p className="text-sm font-semibold text-pink-700">
          ASSISTENTE OPERACIONAL
        </p>
        <h2 className="text-lg font-semibold text-slate-900">
          Recomendações da operação
        </h2>
        <p className="text-sm text-slate-500">
          Pontos que precisam de atenção com base nos dados do ERP.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {recomendacoes.slice(0, 8).map(item => (
          <Link
            key={item.id}
            href={item.href}
            className={`block rounded-2xl border p-4 ${estiloPrioridade[item.prioridade]}`}
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-semibold">{item.titulo}</p>
                <p className="mt-1 text-sm">{item.descricao}</p>
                <p className="mt-2 text-xs font-semibold">
                  Módulo: {item.modulo}
                </p>
              </div>

              <span className="w-fit rounded-full bg-white/70 px-3 py-1 text-xs font-bold">
                Prioridade {item.prioridade}
              </span>
            </div>
          </Link>
        ))}

        {recomendacoes.length === 0 && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800">
            <p className="font-semibold">Operação sem alertas críticos</p>
            <p className="mt-1 text-sm">
              Nenhuma recomendação urgente foi encontrada.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
