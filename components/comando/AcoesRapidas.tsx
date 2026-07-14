import Link from 'next/link'

const acoes = [
  { nome: 'Nova reserva', href: '/reservas' },
  { nome: 'Novo cliente', href: '/clientes' },
  { nome: 'Financeiro', href: '/financeiro' },
  { nome: 'Abrir agenda', href: '/agenda' },
  { nome: 'Contratos', href: '/contratos' },
  { nome: 'Workflow', href: '/workflow' }
]

export function AcoesRapidas() {
  return (
    <div className="rounded-3xl border bg-white p-5 md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Ações rápidas</h2>
      <p className="text-sm text-slate-500">
        Acesse as operações mais utilizadas.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {acoes.map(acao => (
          <Link
            key={acao.nome}
            href={acao.href}
            className="rounded-xl border bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700"
          >
            {acao.nome}
          </Link>
        ))}
      </div>
    </div>
  )
}
