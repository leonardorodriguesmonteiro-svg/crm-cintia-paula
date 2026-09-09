'use client'

import Link from 'next/link'
import { ArrowRight, FileText, ShieldCheck } from 'lucide-react'
import { PreReservasPanel } from '@/components/comercial/PreReservasPanel'

export function FunilComercialPage() {
  return (
    <div className="space-y-6 p-4 pb-32 md:p-8">
      <header className="rounded-3xl border border-pink-100 bg-white p-5 shadow-sm md:p-7">
        <p className="text-sm font-semibold text-pink-700">COMERCIAL</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Esteira do cliente</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Toda solicitação, independentemente de ter chegado pelo site ou pelo atendimento,
          começa como pré-reserva. Depois da análise, a equipe prepara a proposta e o cliente
          conclui os dados, o contrato e o pagamento sem redigitação.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">1. Entrada</p>
            <p className="mt-1 font-semibold text-slate-900">Solicitação e análise</p>
            <p className="mt-1 text-xs text-slate-500">Dados mínimos, itens desejados e data do evento.</p>
          </div>
          <div className="rounded-2xl bg-violet-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">2. Proposta</p>
            <p className="mt-1 font-semibold text-slate-900">Composição e aceite</p>
            <p className="mt-1 text-xs text-slate-500">Preço, validade e resposta do cliente em um link seguro.</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">3. Formalização</p>
            <p className="mt-1 font-semibold text-slate-900">Contrato, sinal e reserva</p>
            <p className="mt-1 text-xs text-slate-500">A reserva nasce somente quando os requisitos forem concluídos.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/orcamentos" className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-700">
            <FileText size={17} /> Ver propostas <ArrowRight size={16} />
          </Link>
          <Link href="/reservas" className="inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <ShieldCheck size={17} /> Ver reservas confirmadas
          </Link>
        </div>
      </header>

      <PreReservasPanel />
    </div>
  )
}
