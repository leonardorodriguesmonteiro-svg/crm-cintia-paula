'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ItemComposicao = {
  quantidade?: number
  item?: {
    id?: string
    nome?: string
    categoria?: string | null
  } | null
}

type Kit = {
  id: string
  codigo?: string | null
  nome: string
  tema?: string | null
  categoria?: string | null
  descricao?: string | null
  preco?: number | null
  foto_url?: string | null
  disponivel?: boolean
  composicao?: ItemComposicao[]
}

type Ordenacao = 'destaques' | 'menor-preco' | 'maior-preco' | 'az'

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function textoNormalizado(valor?: string | null) {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

function KitImagem({ kit, destaque = false }: { kit: Kit; destaque?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-pink-50 to-slate-100 ${destaque ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
      {kit.foto_url ? (
        <img
          src={kit.foto_url}
          alt={kit.nome}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
          <span className="text-5xl">🎈</span>
          <span className="text-xs font-bold uppercase tracking-wider">Foto em atualização</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        {kit.tema ? <span className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-800 shadow-sm">{kit.tema}</span> : null}
        {kit.categoria ? <span className="rounded-full bg-pink-600/95 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white shadow-sm">{kit.categoria}</span> : null}
      </div>
    </div>
  )
}

export function CatalogoPublicoResumo() {
  const [kits, setKits] = useState<Kit[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tema, setTema] = useState('')
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('destaques')
  const [detalhe, setDetalhe] = useState<Kit | null>(null)

  useEffect(() => {
    fetch('/api/catalogo', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.erro || 'Não foi possível carregar o catálogo agora.')
        setKits(Array.isArray(data?.kits) ? data.kits : [])
      })
      .catch((error) => setErro(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo agora.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => {
    if (!detalhe) return
    const fechar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetalhe(null)
    }
    window.addEventListener('keydown', fechar)
    return () => window.removeEventListener('keydown', fechar)
  }, [detalhe])

  const publicados = useMemo(
    () =>
      kits
        .filter((kit) => kit.disponivel !== false)
        .filter((kit) => Number(kit.preco || 0) > 0)
        .filter((kit) => !/^(excluir|teste\b)/i.test((kit.nome || '').trim())),
    [kits]
  )

  const categorias = useMemo(
    () => [...new Set(publicados.map((kit) => kit.categoria?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [publicados]
  )

  const temas = useMemo(
    () => [...new Set(publicados.map((kit) => kit.tema?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 16),
    [publicados]
  )

  const destaques = useMemo(
    () => publicados.filter((kit) => Boolean(kit.foto_url)).slice(0, 3),
    [publicados]
  )

  const filtrados = useMemo(() => {
    const termo = textoNormalizado(busca.trim())
    const lista = publicados.filter((kit) => {
      const atendeBusca = !termo || textoNormalizado([
        kit.nome,
        kit.tema,
        kit.categoria,
        kit.descricao,
        kit.codigo
      ].filter(Boolean).join(' ')).includes(termo)
      const atendeCategoria = !categoria || kit.categoria === categoria
      const atendeTema = !tema || kit.tema === tema
      return atendeBusca && atendeCategoria && atendeTema
    })

    return [...lista].sort((a, b) => {
      if (ordenacao === 'menor-preco') return Number(a.preco || 0) - Number(b.preco || 0)
      if (ordenacao === 'maior-preco') return Number(b.preco || 0) - Number(a.preco || 0)
      if (ordenacao === 'az') return a.nome.localeCompare(b.nome, 'pt-BR')
      const fotoA = a.foto_url ? 1 : 0
      const fotoB = b.foto_url ? 1 : 0
      if (fotoA !== fotoB) return fotoB - fotoA
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [busca, categoria, ordenacao, publicados, tema])

  function limparFiltros() {
    setBusca('')
    setCategoria('')
    setTema('')
    setOrdenacao('destaques')
  }

  if (carregando) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="aspect-[4/3] animate-pulse bg-slate-100" />
            <div className="space-y-3 p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
              <div className="h-8 w-28 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (erro) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center text-red-900">
        <p className="font-black">Não conseguimos carregar os kits agora.</p>
        <p className="mt-2 text-sm">{erro}</p>
      </div>
    )
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
    <div className="space-y-12">
      {destaques.length > 0 ? (
        <section>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Inspire-se</p>
              <h2 className="mt-1 text-2xl font-black md:text-3xl">Kits em destaque</h2>
            </div>
            <Link href="/reservar" className="text-sm font-black text-pink-700 hover:text-pink-800">Prefere montar o seu? →</Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {destaques.map((kit) => (
              <button
                type="button"
                key={kit.id}
                onClick={() => setDetalhe(kit)}
                className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <KitImagem kit={kit} destaque />
                <div className="p-5">
                  <h3 className="line-clamp-2 text-xl font-black leading-6">{kit.nome}</h3>
                  <div className="mt-4 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">A partir de</p>
                      <p className="text-2xl font-black text-pink-700">{moeda(Number(kit.preco || 0))}</p>
                    </div>
                    <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">Ver detalhes</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <label className="relative block">
              <span className="sr-only">Buscar kit</span>
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Busque por tema, nome ou estilo..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-pink-400 focus:bg-white focus:ring-4 focus:ring-pink-100"
              />
            </label>

            <select
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold outline-none focus:border-pink-400"
            >
              <option value="">Todas as categorias</option>
              {categorias.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>

            <select
              value={ordenacao}
              onChange={(event) => setOrdenacao(event.target.value as Ordenacao)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold outline-none focus:border-pink-400"
            >
              <option value="destaques">Destaques primeiro</option>
              <option value="menor-preco">Menor preço</option>
              <option value="maior-preco">Maior preço</option>
              <option value="az">Nome A–Z</option>
            </select>
          </div>

          {temas.length > 0 ? (
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setTema('')}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition ${!tema ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                Todos os temas
              </button>
              {temas.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => setTema(item === tema ? '' : item)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition ${tema === item ? 'bg-pink-600 text-white' : 'bg-pink-50 text-pink-700 hover:bg-pink-100'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-500">
            <strong className="text-slate-950">{filtrados.length}</strong> {filtrados.length === 1 ? 'kit encontrado' : 'kits encontrados'}
          </p>
          {(busca || categoria || tema || ordenacao !== 'destaques') ? (
            <button type="button" onClick={limparFiltros} className="text-sm font-black text-pink-700 hover:text-pink-800">Limpar filtros</button>
          ) : null}
        </div>

        {filtrados.length > 0 ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((kit) => (
              <article key={kit.id} className="group overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <button type="button" onClick={() => setDetalhe(kit)} className="block w-full text-left">
                  <KitImagem kit={kit} />
                </button>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-pink-600">{kit.tema || kit.categoria || 'Pegue e Monte'}</p>
                      <button type="button" onClick={() => setDetalhe(kit)} className="mt-1 block text-left">
                        <h2 className="line-clamp-2 min-h-12 text-lg font-black leading-6 transition group-hover:text-pink-700">{kit.nome}</h2>
                      </button>
                    </div>
                  </div>

                  {kit.descricao ? <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{kit.descricao}</p> : <div className="mt-3 min-h-10" />}

                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Valor do kit</p>
                      <p className="text-2xl font-black text-slate-950">{moeda(Number(kit.preco || 0))}</p>
                    </div>
                    <span className="rounded-full bg-green-50 px-3 py-1.5 text-[11px] font-black text-green-700">Disponível no catálogo</span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDetalhe(kit)}
                      className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                    >
                      Ver detalhes
                    </button>
                    <Link
                      href="/reservar"
                      className="rounded-2xl bg-pink-600 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-pink-700"
                    >
                      Quero este kit
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-xl font-black">Nenhum kit encontrado com esses filtros.</p>
            <p className="mt-2 text-sm text-slate-500">Tente outro tema ou monte uma composição personalizada.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={limparFiltros} className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-black">Limpar filtros</button>
              <Link href="/reservar" className="rounded-full bg-pink-600 px-5 py-2.5 text-sm font-black text-white">Monte seu kit</Link>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2.5rem] bg-slate-950 px-6 py-10 text-white md:px-10 md:py-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-400">Não encontrou exatamente o que imaginou?</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black md:text-4xl">Monte seu próprio kit com peças do nosso estoque.</h2>
            <p className="mt-4 max-w-2xl leading-7 text-slate-300">Escolha os itens que combinam com a sua festa e envie a composição para nossa equipe preparar o orçamento.</p>
          </div>
          <Link href="/reservar" className="rounded-full bg-pink-500 px-7 py-3.5 text-center font-black text-white transition hover:bg-pink-400">Montar meu kit →</Link>
        </div>
      </section>

      {detalhe ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm md:items-center md:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${detalhe.nome}`}
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setDetalhe(null)
          }}
        >
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl md:rounded-[2rem]">
            <div className="grid lg:grid-cols-[1.05fr_.95fr]">
              <div className="relative min-h-72 bg-slate-100 lg:min-h-[580px]">
                {detalhe.foto_url ? (
                  <img src={detalhe.foto_url} alt={detalhe.nome} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full min-h-72 items-center justify-center text-7xl">🎈</div>
                )}
                <button
                  type="button"
                  onClick={() => setDetalhe(null)}
                  className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl font-black text-slate-900 shadow-lg"
                  aria-label="Fechar detalhes"
                >
                  ×
                </button>
              </div>

              <div className="p-6 md:p-8 lg:p-10">
                <div className="flex flex-wrap gap-2">
                  {detalhe.tema ? <span className="rounded-full bg-pink-50 px-3 py-1.5 text-xs font-black uppercase text-pink-700">{detalhe.tema}</span> : null}
                  {detalhe.categoria ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase text-slate-600">{detalhe.categoria}</span> : null}
                </div>
                <h2 className="mt-5 text-3xl font-black leading-tight md:text-4xl">{detalhe.nome}</h2>
                {detalhe.descricao ? <p className="mt-5 leading-7 text-slate-600">{detalhe.descricao}</p> : null}

                <div className="mt-6 rounded-3xl bg-pink-50 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-pink-600">Valor do kit</p>
                  <p className="mt-1 text-3xl font-black text-pink-700">{moeda(Number(detalhe.preco || 0))}</p>
                  <p className="mt-2 text-xs leading-5 text-pink-900/70">A disponibilidade para a data escolhida é confirmada durante a análise da solicitação.</p>
                </div>

                {Array.isArray(detalhe.composicao) && detalhe.composicao.filter((item) => item?.item?.nome).length > 0 ? (
                  <div className="mt-7">
                    <p className="text-sm font-black uppercase tracking-wide text-slate-900">O que compõe este kit</p>
                    <div className="mt-3 space-y-2">
                      {detalhe.composicao.filter((item) => item?.item?.nome).slice(0, 8).map((componente, index) => (
                        <div key={`${componente.item?.id || componente.item?.nome}-${index}`} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                          <span className="font-bold text-slate-700">{componente.item?.nome}</span>
                          <span className="shrink-0 font-black text-slate-500">{Number(componente.quantidade || 1)}x</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setDetalhe(null)} className="rounded-2xl border border-slate-200 px-5 py-3.5 font-black text-slate-700">Continuar olhando</button>
                  <Link href="/reservar" className="rounded-2xl bg-pink-600 px-5 py-3.5 text-center font-black text-white hover:bg-pink-700">Quero reservar este kit</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
