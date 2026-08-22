'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Kit = {
  id: string
  nome: string
  tema?: string | null
  categoria?: string | null
  preco?: number | null
  foto_url?: string | null
  disponivel?: boolean
}

export function CatalogoPublicoResumo() {
  const [kits, setKits] = useState<Kit[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/catalogo')
      .then((res) => res.json())
      .then((data) => setKits(Array.isArray(data?.kits) ? data.kits : []))
      .finally(() => setCarregando(false))
  }, [])

  const publicados = useMemo(
    () =>
      kits
        .filter((kit) => kit.disponivel !== false)
        .filter((kit) => Number(kit.preco || 0) > 0)
        .filter((kit) => !/^(excluir|teste\b)/i.test((kit.nome || '').trim()))
        .slice(0, 18),
    [kits]
  )

  if (carregando) {
    return <p className="py-12 text-center text-slate-500">Carregando kits...</p>
  }

  if (!publicados.length) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-bold">O catálogo está sendo atualizado.</p>
        <Link href="/reservar" className="mt-4 inline-block font-black text-pink-700">Solicitar uma composição →</Link>
      </div>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {publicados.map((kit) => (
        <article key={kit.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="aspect-[4/3] bg-slate-100">
            {kit.foto_url ? (
              <img src={kit.foto_url} alt={kit.nome} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-bold text-slate-400">Foto em atualização</div>
            )}
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500">
              {kit.tema ? <span>{kit.tema}</span> : null}
              {kit.categoria ? <span>• {kit.categoria}</span> : null}
            </div>
            <h2 className="mt-2 min-h-12 text-lg font-black leading-6">{kit.nome}</h2>
            <p className="mt-4 text-2xl font-black text-pink-700">
              {Number(kit.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <Link href="/reservar" className="mt-5 inline-flex rounded-full bg-pink-600 px-4 py-2 text-sm font-black text-white hover:bg-pink-700">
              Quero este kit
            </Link>
          </div>
        </article>
      ))}
    </div>
  )
}
