'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Kit = {
  id: string
  nome: string
  tema?: string | null
  categoria?: string | null
  descricao?: string | null
  preco?: number | null
  foto_url?: string | null
  disponivel?: boolean
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export function HomeKitsDestaque() {
  const [kits, setKits] = useState<Kit[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    fetch('/api/catalogo', { cache: 'no-store' })
      .then(async (resposta) => {
        const dados = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error('Não foi possível carregar o catálogo.')
        setKits(Array.isArray(dados?.kits) ? dados.kits : [])
      })
      .catch(() => setKits([]))
      .finally(() => setCarregando(false))
  }, [])

  const destaques = useMemo(
    () =>
      kits
        .filter((kit) => kit.disponivel !== false)
        .filter((kit) => Number(kit.preco || 0) > 0)
        .filter((kit) => Boolean(kit.foto_url))
        .filter((kit) => !/^(excluir|teste\b)/i.test((kit.nome || '').trim()))
        .slice(0, 8),
    [kits]
  )

  if (!carregando && destaques.length === 0) return null

  return (
    <section className="brand-catalogo px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-pink-600">Escolha a sua inspiração</p>
            <h2 className="brand-title mt-3 max-w-3xl">
              Pequenos detalhes. Grandes celebrações.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Explore nossas decorações e encontre a combinação que tem a sua cara.
            </p>
          </div>
          <Link
            href="/site/kits"
            className="w-fit rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-800 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700"
          >
            Ver todos os kits →
          </Link>
        </div>

        {carregando ? (
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
                <div className="aspect-[4/3] animate-pulse bg-slate-100" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-8 w-28 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {destaques.map((kit) => (
              <article
                key={kit.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-pink-200 hover:shadow-md"
              >
                <Link href={`/reservar?kit=${encodeURIComponent(kit.id)}`} className="block aspect-[4/3] overflow-hidden bg-slate-100" aria-label={`Ver kit ${kit.nome}`}>
                  <img src={kit.foto_url || ''} alt={kit.nome} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                </Link>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-700" title={kit.nome}>{kit.nome}</h3>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{moeda(Number(kit.preco || 0))}</p>
                  <Link href={`/reservar?kit=${encodeURIComponent(kit.id)}`} className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-pink-200 px-2 py-2 text-center text-xs font-semibold text-pink-700 transition hover:bg-pink-50">
                    Quero este kit
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}


      </div>
    </section>
  )
}
