'use client'

import { Printer } from 'lucide-react'

export function PrintContractButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="mx-auto mb-5 flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white print:hidden"
    >
      <Printer size={17} /> Baixar como PDF ou imprimir
    </button>
  )
}
