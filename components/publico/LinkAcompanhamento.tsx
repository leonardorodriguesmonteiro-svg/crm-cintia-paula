'use client'
export function LinkAcompanhamento({ url }: { url?: string | null }) {
  if (!url) return <p className="mt-5 text-sm text-slate-600">Guarde o número da solicitação. Peça à equipe seu link de acompanhamento.</p>
  return <div className="mt-6 rounded-2xl border border-pink-200 bg-pink-50 p-5">
    <a href={url} className="inline-block rounded-xl bg-pink-600 px-5 py-3 font-bold text-white">Acompanhar meu pedido</a>
    <p className="mt-3 text-sm leading-6 text-slate-700">Guarde este link privado para consultar o andamento. Compartilhe somente com quem participa da sua reserva.</p>
    <input aria-label="Seu link privado de acompanhamento" readOnly value={url} onFocus={e => e.target.select()} className="mt-3 w-full rounded-lg border bg-white p-3 text-sm" />
  </div>
}
