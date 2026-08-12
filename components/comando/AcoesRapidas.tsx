'use client'

import Link from 'next/link'
import { useAcesso } from '@/components/auth/AcessoContext'
import type { ModuloAcesso } from '@/lib/access'

const acoes: { nome: string; href: string; modulo: ModuloAcesso }[] = [
  { nome: 'Nova reserva', href: '/reservas', modulo: 'reservas' },
  { nome: 'Novo cliente', href: '/clientes', modulo: 'clientes' },
  { nome: 'Financeiro', href: '/financeiro', modulo: 'financeiro' },
  { nome: 'Abrir agenda', href: '/agenda', modulo: 'agenda' },
  { nome: 'Contratos', href: '/contratos', modulo: 'contratos' },
  { nome: 'Workflow', href: '/workflow', modulo: 'operacao' }
]

export function AcoesRapidas() {
  const { pode } = useAcesso()
  const acoesVisiveis = acoes.filter(acao => pode(acao.modulo))

  return (
    <div className="rounded-3xl border bg-white p-5 md:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Ações rápidas</h2>
      <p className="text-sm text-slate-500">
        Acesse as operações mais utilizadas.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {acoesVisiveis.map(acao => (
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
