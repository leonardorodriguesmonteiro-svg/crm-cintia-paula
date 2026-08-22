'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ReservaPublicaPage } from '@/components/publico/ReservaPublicaPage'

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

type Formulario = {
  nome: string
  celular: string
  email: string
  data_evento: string
  tipo_evento: string
  modalidade: 'Retirada' | 'Entrega'
  observacoes: string
  website: string
}

const formularioInicial: Formulario = {
  nome: '',
  celular: '',
  email: '',
  data_evento: '',
  tipo_evento: '',
  modalidade: 'Retirada',
  observacoes: '',
  website: ''
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function celularNormalizado(valor: string) {
  return valor.replace(/\D/g, '').slice(0, 11)
}

function chaveIdempotencia() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `site-kit-${crypto.randomUUID()}`
  }
  return `site-kit-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ReservaPublicaDireta() {
  const [kitId, setKitId] = useState<string | null | undefined>(undefined)
  const [kit, setKit] = useState<Kit | null>(null)
  const [catalogoHref, setCatalogoHref] = useState('/site/kits')
  const [formulario, setFormulario] = useState<Formulario>(formularioInicial)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ numero?: number; mensagem: string } | null>(null)

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    setKitId(parametros.get('kit'))

    const host = window.location.hostname.toLowerCase()
    const dominioComercial = host === 'cintiapaulafestaedecoracao.com.br' || host === 'www.cintiapaulafestaedecoracao.com.br'
    setCatalogoHref(dominioComercial ? '/kits' : '/site/kits')
  }, [])

  useEffect(() => {
    if (kitId === undefined) return
    if (!kitId) {
      setCarregando(false)
      return
    }

    setCarregando(true)
    setErro('')

    fetch('/api/catalogo', { cache: 'no-store' })
      .then(async (resposta) => {
        const dados = await resposta.json().catch(() => ({}))
        if (!resposta.ok) throw new Error(dados?.erro || 'Não foi possível carregar o kit agora.')

        const kits = Array.isArray(dados?.kits) ? dados.kits as Kit[] : []
        const encontrado = kits.find((item) => item.id === kitId)
        const publicavel = encontrado
          && encontrado.disponivel !== false
          && Number(encontrado.preco || 0) > 0
          && !/^(excluir|teste\b)/i.test((encontrado.nome || '').trim())

        if (!publicavel) throw new Error('Este kit não está disponível para reserva pelo site neste momento.')
        setKit(encontrado || null)
      })
      .catch((error) => setErro(error instanceof Error ? error.message : 'Não foi possível carregar o kit agora.'))
      .finally(() => setCarregando(false))
  }, [kitId])

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!kit) return

    setErro('')
    setSucesso(null)

    if (formulario.nome.trim().length < 2) return setErro('Informe seu nome.')
    if (celularNormalizado(formulario.celular).length < 10) return setErro('Informe um WhatsApp válido.')
    if (!/^\S+@\S+\.\S+$/.test(formulario.email.trim())) return setErro('Informe um e-mail válido.')
    if (!formulario.data_evento) return setErro('Informe a data da festa.')

    setEnviando(true)

    try {
      const interesse = [
        formulario.tipo_evento.trim() ? `Tipo de evento: ${formulario.tipo_evento.trim()}` : null,
        `Modalidade: ${formulario.modalidade}`,
        `Escolha: KIT pronto e precificado - ${kit.nome}`,
        formulario.observacoes.trim() ? `Observações: ${formulario.observacoes.trim()}` : null
      ].filter(Boolean).join(' | ')

      const resposta = await fetch('/api/publico/pre-reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': chaveIdempotencia()
        },
        body: JSON.stringify({
          nome: formulario.nome.trim(),
          celular: celularNormalizado(formulario.celular),
          email: formulario.email.trim().toLowerCase(),
          data_evento: formulario.data_evento,
          interesse,
          website: formulario.website,
          itens: [{ tipo: 'KIT', id: kit.id, quantidade: 1 }]
        })
      })

      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível enviar sua solicitação agora.')

      setSucesso({
        numero: corpo.pre_reserva?.numero,
        mensagem: corpo.mensagem || 'Sua solicitação foi recebida.'
      })
      setFormulario(formularioInicial)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar sua solicitação agora.')
    } finally {
      setEnviando(false)
    }
  }

  if (kitId === undefined) {
    return <div className="min-h-screen bg-slate-50" />
  }

  if (!kitId) {
    return <ReservaPublicaPage />
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl animate-pulse rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-8 w-64 rounded bg-slate-100" />
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div className="aspect-[4/3] rounded-3xl bg-slate-100" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-12 rounded-2xl bg-slate-100" />)}
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (!kit) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-900">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">!</div>
          <h1 className="mt-5 text-2xl font-black">Kit indisponível</h1>
          <p className="mt-3 leading-7 text-slate-600">{erro || 'Não encontramos este kit no catálogo público.'}</p>
          <Link href={catalogoHref} className="mt-6 inline-flex rounded-full bg-pink-600 px-6 py-3 font-black text-white hover:bg-pink-700">Escolher outro kit</Link>
        </div>
      </main>
    )
  }

  if (sucesso) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-pink-100 bg-white p-8 text-center shadow-xl shadow-pink-100/50 md:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-700">✓</div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-pink-600">Cintia Paula Festas &amp; Decorações</p>
          <h1 className="mt-3 text-3xl font-black">Solicitação recebida!</h1>
          {sucesso.numero ? <p className="mt-2 text-lg font-black text-pink-700">Pré-reserva #{String(sucesso.numero).padStart(4, '0')}</p> : null}
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">{sucesso.mensagem}</p>
          <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-left">
            <p className="text-sm font-black text-slate-900">Kit solicitado</p>
            <p className="mt-1 text-sm text-slate-600">{kit.nome} · {moeda(Number(kit.preco || 0))}</p>
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            A solicitação ainda será analisada. O estoque só fica comprometido quando a reserva for confirmada após a formalização.
          </div>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href={catalogoHref} className="rounded-full border border-slate-200 px-5 py-3 font-black text-slate-700 hover:bg-slate-50">Ver outros kits</Link>
            <Link href="/" className="rounded-full bg-pink-600 px-5 py-3 font-black text-white hover:bg-pink-700">Voltar ao início</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-pink-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 md:px-8">
          <Link href="/" className="min-w-fit">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Cintia Paula</p>
            <p className="text-lg font-black">Festas &amp; Decorações</p>
          </Link>
          <Link href={catalogoHref} className="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-xs font-black text-pink-700 hover:bg-pink-100">← Trocar kit</Link>
        </div>
      </header>

      <section className="bg-gradient-to-br from-pink-50 via-white to-rose-50 px-4 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-pink-600">Reserva expressa</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Seu kit já está selecionado.</h1>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">Agora informe os dados da festa. Nossa equipe valida a data e segue com proposta, contrato e pagamento.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-7 px-4 py-8 md:px-8 lg:grid-cols-[.9fr_1.1fr] lg:py-12">
        <aside className="h-fit lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="aspect-[4/3] bg-slate-100">
              {kit.foto_url ? <img src={kit.foto_url} alt={kit.nome} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-7xl">🎈</div>}
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-pink-600">{kit.tema || kit.categoria || 'Pegue e Monte'}</p>
              <h2 className="mt-2 text-2xl font-black leading-tight">{kit.nome}</h2>
              {kit.descricao ? <p className="mt-3 text-sm leading-6 text-slate-600">{kit.descricao}</p> : null}
              <div className="mt-5 flex items-end justify-between gap-4 border-t border-slate-100 pt-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Valor do kit</p>
                  <p className="mt-1 text-3xl font-black text-pink-700">{moeda(Number(kit.preco || 0))}</p>
                </div>
                <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-black text-green-700">Selecionado ✓</span>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <strong>Importante:</strong> esta solicitação não bloqueia o estoque. A disponibilidade é revalidada antes da confirmação definitiva da reserva.
          </div>
        </aside>

        <form onSubmit={enviar} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Quase lá</p>
            <h2 className="mt-2 text-2xl font-black md:text-3xl">Dados da sua festa</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Preencha os dados abaixo para enviarmos a solicitação para análise.</p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-black text-slate-700">Nome *</span>
              <input value={formulario.nome} onChange={(event) => setFormulario({ ...formulario, nome: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="Seu nome" />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-black text-slate-700">WhatsApp *</span>
              <input value={formulario.celular} onChange={(event) => setFormulario({ ...formulario, celular: event.target.value })} inputMode="tel" className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="(21) 99999-9999" />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-black text-slate-700">E-mail *</span>
              <input value={formulario.email} onChange={(event) => setFormulario({ ...formulario, email: event.target.value })} type="email" className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="voce@email.com" />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-black text-slate-700">Data da festa *</span>
              <input value={formulario.data_evento} onChange={(event) => setFormulario({ ...formulario, data_evento: event.target.value })} type="date" className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-black text-slate-700">Tipo de evento</span>
              <input value={formulario.tipo_evento} onChange={(event) => setFormulario({ ...formulario, tipo_evento: event.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="Aniversário, casamento..." />
            </label>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-black text-slate-700">Como deseja receber o kit?</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(['Retirada', 'Entrega'] as const).map((modalidade) => (
                <button key={modalidade} type="button" onClick={() => setFormulario({ ...formulario, modalidade })} className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${formulario.modalidade === modalidade ? 'border-pink-500 bg-pink-50 text-pink-700 ring-2 ring-pink-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {modalidade}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-black text-slate-700">Observações</span>
            <textarea value={formulario.observacoes} onChange={(event) => setFormulario({ ...formulario, observacoes: event.target.value })} rows={4} className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3.5 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-100" placeholder="Conte algum detalhe importante sobre a festa..." />
          </label>

          <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={formulario.website} onChange={(event) => setFormulario({ ...formulario, website: event.target.value })} className="hidden" />

          {erro ? <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-800">{erro}</div> : null}

          <button type="submit" disabled={enviando} className="mt-6 w-full rounded-2xl bg-pink-600 px-6 py-4 text-base font-black text-white shadow-sm transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60">
            {enviando ? 'Enviando solicitação...' : `Solicitar reserva · ${moeda(Number(kit.preco || 0))}`}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-slate-400">Ao enviar, você solicita a análise de disponibilidade. A reserva só é confirmada depois das etapas de formalização.</p>
        </form>
      </section>
    </main>
  )
}
