import Link from 'next/link'

export function ConfiguracoesPage() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-2 text-slate-500">Administração e preferências do ERP.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/administracao/feedbacks"
          className="rounded-3xl border bg-white p-6 transition hover:border-pink-200 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Central de Feedback</h2>
          <p className="mt-1 text-sm text-slate-500">
            Consulte, classifique e responda sugestões enviadas pelo ERP.
          </p>
        </Link>
      </div>
    </div>
  )
}
