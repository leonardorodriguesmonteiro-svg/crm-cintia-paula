'use client'

import { useEffect, useMemo, useState } from 'react'

type KitCatalogo = {
  id: string
  codigo: string | null
  nome: string
  tema: string | null
  categoria: string | null
  descricao: string | null
  preco: number
  disponivel: boolean
  foto_url: string | null
  composicao: Array<{
    quantidade: number
    item: {
      id: string
      codigo: string | null
      nome: string
      categoria: string | null
      cor: string | null
      foto_url: string | null
      disponivel: boolean
    } | null
  }>
}

type ItemEstoque = {
  id: string
  codigo: string | null
  nome: string
  categoria: string | null
  cor: string | null
  foto_url: string | null
  disponivel: boolean
}

type Catalogo = {
  kits: KitCatalogo[]
  estoque: ItemEstoque[]
}

type ItemSelecionado = {
  id: string
  tipo: 'KIT' | 'ITEM_ESTOQUE'
  nome: string
  quantidade: number
  preco?: number
  foto_url?: string | null
}

type Modo = 'KIT' | 'PERSONALIZADO' | null

type FormContato = {
  nome: string
  celular: string
  email: string
  data_evento: string
  tipo_evento: string
  modalidade: 'Retirada' | 'Entrega'
  observacoes: string
  website: string
}

const contatoInicial: FormContato = {
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

function normalizarCelular(valor: string) {
  return valor.replace(/\D/g, '').slice(0, 11)
}

function criarChaveIdempotencia() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `site-${crypto.randomUUID()}`
  }
  return `site-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function ReservaPublicaPage() {
  const [catalogo, setCatalogo] = useState<Catalogo>({ kits: [], estoque: [] })
  const [modo, setModo] = useState<Modo>(null)
  const [itens, setItens] = useState<ItemSelecionado[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [contato, setContato] = useState<FormContato>(contatoInicial)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ numero?: number; mensagem: string } | null>(null)

  useEffect(() => {
    fetch('/api/catalogo', { cache: 'no-store' })
      .then(async resposta => {
        const dados = await resposta.json()
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível carregar o catálogo.')
        setCatalogo({ kits: dados.kits || [], estoque: dados.estoque || [] })
      })
      .catch(error => setErro(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo.'))
      .finally(() => setCarregando(false))
  }, [])

  const categorias = useMemo(() => {
    const origem = modo === 'KIT' ? catalogo.kits : catalogo.estoque
    return [...new Set(origem.map(item => item.categoria).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [catalogo, modo])

  const kitsFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return catalogo.kits.filter(kit => {
      const atendeBusca = !termo || [kit.codigo, kit.nome, kit.tema, kit.categoria, kit.descricao]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(termo)
      const atendeCategoria = !categoria || kit.categoria === categoria
      return atendeBusca && atendeCategoria
    })
  }, [busca, categoria, catalogo.kits])

  const estoqueFiltrado = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return catalogo.estoque.filter(item => {
      const atendeBusca = !termo || [item.codigo, item.nome, item.categoria, item.cor]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(termo)
      const atendeCategoria = !categoria || item.categoria === categoria
      return atendeBusca && atendeCategoria
    })
  }, [busca, categoria, catalogo.estoque])

  const totalKits = useMemo(
    () => itens.reduce((total, item) => total + (item.tipo === 'KIT' ? Number(item.preco || 0) * item.quantidade : 0), 0),
    [itens]
  )

  function escolherModo(novoModo: Exclude<Modo, null>) {
    setModo(novoModo)
    setItens([])
    setBusca('')
    setCategoria('')
    setErro('')
    setSucesso(null)
  }

  function adicionarKit(kit: KitCatalogo) {
    setItens([{ id: kit.id, tipo: 'KIT', nome: kit.nome, quantidade: 1, preco: kit.preco, foto_url: kit.foto_url }])
  }

  function adicionarItem(item: ItemEstoque) {
    setItens(atuais => {
      const existente = atuais.find(selecionado => selecionado.tipo === 'ITEM_ESTOQUE' && selecionado.id === item.id)
      if (existente) {
        return atuais.map(selecionado => selecionado.id === item.id
          ? { ...selecionado, quantidade: selecionado.quantidade + 1 }
          : selecionado)
      }
      return [...atuais, { id: item.id, tipo: 'ITEM_ESTOQUE', nome: item.nome, quantidade: 1, foto_url: item.foto_url }]
    })
  }

  function alterarQuantidade(id: string, quantidade: number) {
    if (quantidade <= 0) {
      setItens(atuais => atuais.filter(item => item.id !== id))
      return
    }
    setItens(atuais => atuais.map(item => item.id === id ? { ...item, quantidade } : item))
  }

  function montarInteresse() {
    const partes = [
      contato.tipo_evento ? `Tipo de evento: ${contato.tipo_evento}` : null,
      `Modalidade: ${contato.modalidade}`,
      modo === 'KIT' ? 'Escolha: KIT pronto e precificado' : 'Escolha: Monte seu KIT pelo estoque',
      contato.observacoes.trim() ? `Observações: ${contato.observacoes.trim()}` : null
    ].filter(Boolean)
    return partes.join(' | ')
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')
    setSucesso(null)

    if (!modo) return setErro('Escolha como deseja montar sua festa.')
    if (!itens.length) return setErro(modo === 'KIT' ? 'Escolha um KIT.' : 'Adicione pelo menos um item ao seu KIT.')
    if (contato.nome.trim().length < 2) return setErro('Informe seu nome.')
    if (normalizarCelular(contato.celular).length < 10) return setErro('Informe um WhatsApp válido.')
    if (!/^\S+@\S+\.\S+$/.test(contato.email.trim())) return setErro('Informe um e-mail válido.')
    if (!contato.data_evento) return setErro('Informe a data do evento.')

    setEnviando(true)

    try {
      const resposta = await fetch('/api/publico/pre-reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': criarChaveIdempotencia()
        },
        body: JSON.stringify({
          nome: contato.nome.trim(),
          celular: normalizarCelular(contato.celular),
          email: contato.email.trim().toLowerCase(),
          data_evento: contato.data_evento,
          interesse: montarInteresse(),
          website: contato.website,
          itens: itens.map(item => ({ tipo: item.tipo, id: item.id, quantidade: item.quantidade }))
        })
      })

      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível enviar sua solicitação agora.')

      setSucesso({
        numero: corpo.pre_reserva?.numero,
        mensagem: corpo.mensagem || 'Sua solicitação foi recebida.'
      })
      setContato(contatoInicial)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar sua solicitação agora.')
    } finally {
      setEnviando(false)
    }
  }

  if (sucesso) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-white px-4 py-12 text-slate-900">
        <div className="mx-auto max-w-2xl rounded-3xl border border-pink-100 bg-white p-8 text-center shadow-xl shadow-pink-100/50 md:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">✓</div>
          <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-pink-600">Cintia Paula Festas & Decorações</p>
          <h1 className="mt-3 text-3xl font-black">Pedido recebido!</h1>
          {sucesso.numero && <p className="mt-2 text-lg font-bold text-pink-700">Pré-reserva #{String(sucesso.numero).padStart(4, '0')}</p>}
          <p className="mx-auto mt-4 max-w-xl text-slate-600">{sucesso.mensagem} Vamos analisar a composição e a disponibilidade para a data escolhida.</p>
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Importante:</strong> nesta etapa nenhum item fica bloqueado. O estoque é comprometido somente quando a reserva for confirmada.
          </div>
          <button
            type="button"
            onClick={() => { setSucesso(null); setModo(null); setItens([]) }}
            className="mt-8 rounded-2xl bg-pink-600 px-6 py-3 font-bold text-white transition hover:bg-pink-700"
          >
            Fazer outra solicitação
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-pink-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 md:px-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">Cintia Paula</p>
            <p className="text-lg font-black">Festas & Decorações</p>
          </div>
          <div className="rounded-full bg-pink-50 px-4 py-2 text-xs font-bold text-pink-700">Pegue e Monte</div>
        </div>
      </header>

      <section className="bg-gradient-to-br from-pink-50 via-white to-rose-50 px-4 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-pink-600">Sua festa, do seu jeito</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">Escolha um KIT pronto ou monte o seu</h1>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 md:text-lg">Você pode escolher uma composição já pronta e precificada ou selecionar os itens do nosso estoque para criar um KIT personalizado.</p>
          <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            A seleção abaixo consulta o catálogo, mas <strong>não bloqueia o estoque</strong>. O bloqueio acontece somente na confirmação definitiva da reserva.
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
        <div className="grid gap-5 md:grid-cols-2">
          <button
            type="button"
            onClick={() => escolherModo('KIT')}
            className={`rounded-3xl border p-7 text-left transition hover:-translate-y-1 hover:shadow-lg ${modo === 'KIT' ? 'border-pink-500 bg-pink-50 shadow-md' : 'border-slate-200 bg-white'}`}
          >
            <span className="text-4xl">🎉</span>
            <h2 className="mt-4 text-2xl font-black">Escolher um KIT</h2>
            <p className="mt-2 text-slate-600">Kits já montados, com composição definida e preço cadastrado. Escolha o tema e avance rapidamente.</p>
            <span className="mt-5 inline-block font-bold text-pink-700">Ver KITs prontos →</span>
          </button>

          <button
            type="button"
            onClick={() => escolherModo('PERSONALIZADO')}
            className={`rounded-3xl border p-7 text-left transition hover:-translate-y-1 hover:shadow-lg ${modo === 'PERSONALIZADO' ? 'border-pink-500 bg-pink-50 shadow-md' : 'border-slate-200 bg-white'}`}
          >
            <span className="text-4xl">✨</span>
            <h2 className="mt-4 text-2xl font-black">Monte seu KIT</h2>
            <p className="mt-2 text-slate-600">Escolha peças diretamente do estoque e crie uma composição personalizada. O valor será preparado no orçamento.</p>
            <span className="mt-5 inline-block font-bold text-pink-700">Montar meu KIT →</span>
          </button>
        </div>

        {modo && (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-5">
              <div className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                  <input
                    value={busca}
                    onChange={evento => setBusca(evento.target.value)}
                    placeholder={modo === 'KIT' ? 'Buscar por tema, nome ou categoria...' : 'Buscar item, cor ou categoria...'}
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                  />
                  <select
                    value={categoria}
                    onChange={evento => setCategoria(evento.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-pink-400"
                  >
                    <option value="">Todas as categorias</option>
                    {categorias.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              {carregando && <div className="rounded-3xl border bg-white p-10 text-center text-slate-500">Carregando catálogo...</div>}

              {!carregando && modo === 'KIT' && (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {kitsFiltrados.map(kit => {
                    const selecionado = itens.some(item => item.tipo === 'KIT' && item.id === kit.id)
                    return (
                      <article key={kit.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${selecionado ? 'border-pink-500 ring-2 ring-pink-100' : 'border-slate-200'}`}>
                        <div className="aspect-[4/3] bg-slate-100">
                          {kit.foto_url
                            ? <img src={kit.foto_url} alt={kit.nome} className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center text-5xl">🎈</div>}
                        </div>
                        <div className="p-5">
                          <p className="text-xs font-bold uppercase text-pink-600">{kit.categoria || kit.tema || 'KIT'}</p>
                          <h3 className="mt-1 text-lg font-black">{kit.nome}</h3>
                          {kit.descricao && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{kit.descricao}</p>}
                          <p className="mt-4 text-xl font-black text-slate-900">{moeda(kit.preco)}</p>
                          <p className={`mt-1 text-xs font-bold ${kit.disponivel ? 'text-green-700' : 'text-amber-700'}`}>{kit.disponivel ? 'Disponível no catálogo' : 'Consulte disponibilidade para a data'}</p>
                          <button
                            type="button"
                            onClick={() => adicionarKit(kit)}
                            className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold transition ${selecionado ? 'bg-green-600 text-white' : 'bg-pink-600 text-white hover:bg-pink-700'}`}
                          >
                            {selecionado ? 'KIT selecionado ✓' : 'Escolher este KIT'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}

              {!carregando && modo === 'PERSONALIZADO' && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {estoqueFiltrado.map(item => {
                    const selecionado = itens.find(selecionado => selecionado.id === item.id)
                    return (
                      <article key={item.id} className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${selecionado ? 'border-pink-400' : 'border-slate-200'}`}>
                        <div className="aspect-[4/3] bg-slate-100">
                          {item.foto_url
                            ? <img src={item.foto_url} alt={item.nome} className="h-full w-full object-cover" />
                            : <div className="flex h-full items-center justify-center text-4xl">✨</div>}
                        </div>
                        <div className="p-4">
                          <p className="text-xs font-bold uppercase text-pink-600">{item.categoria || 'Decoração'}</p>
                          <h3 className="mt-1 font-black">{item.nome}</h3>
                          {item.cor && <p className="mt-1 text-xs text-slate-500">Cor: {item.cor}</p>}
                          <p className={`mt-3 text-xs font-bold ${item.disponivel ? 'text-green-700' : 'text-amber-700'}`}>{item.disponivel ? 'Disponível no catálogo' : 'Sujeito à confirmação'}</p>
                          <button
                            type="button"
                            onClick={() => adicionarItem(item)}
                            className="mt-4 w-full rounded-2xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-pink-700"
                          >
                            {selecionado ? `Adicionar mais · ${selecionado.quantidade}` : 'Adicionar ao meu KIT'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}

              {!carregando && ((modo === 'KIT' && kitsFiltrados.length === 0) || (modo === 'PERSONALIZADO' && estoqueFiltrado.length === 0)) && (
                <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-500">Nenhum item encontrado com esses filtros.</div>
              )}
            </div>

            <aside className="h-fit space-y-5 lg:sticky lg:top-5">
              <div className="rounded-3xl border bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-pink-600">Sua seleção</p>
                <h3 className="mt-1 text-xl font-black">{modo === 'KIT' ? 'KIT escolhido' : 'Seu KIT personalizado'}</h3>

                <div className="mt-4 space-y-3">
                  {itens.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white">
                        {item.foto_url ? <img src={item.foto_url} alt="" className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{item.nome}</p>
                        {item.tipo === 'KIT' && <p className="text-xs text-slate-500">{moeda(Number(item.preco || 0))}</p>}
                      </div>
                      {item.tipo === 'ITEM_ESTOQUE' && (
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => alterarQuantidade(item.id, item.quantidade - 1)} className="h-8 w-8 rounded-lg border bg-white font-bold">−</button>
                          <span className="w-7 text-center text-sm font-bold">{item.quantidade}</span>
                          <button type="button" onClick={() => alterarQuantidade(item.id, item.quantidade + 1)} className="h-8 w-8 rounded-lg border bg-white font-bold">+</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {itens.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Sua seleção aparecerá aqui.</p>}
                </div>

                {modo === 'KIT' ? (
                  <div className="mt-5 flex items-center justify-between border-t pt-4">
                    <span className="font-bold">Valor do KIT</span>
                    <strong className="text-xl text-pink-700">{moeda(totalKits)}</strong>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl bg-pink-50 p-4 text-sm text-pink-900">
                    <strong>Orçamento personalizado.</strong> Após receber sua seleção, vamos precificar a composição e enviar a proposta.
                  </div>
                )}
              </div>

              <form onSubmit={enviar} className="rounded-3xl border bg-white p-5 shadow-sm">
                <h3 className="text-xl font-black">Dados para a reserva</h3>
                <p className="mt-1 text-sm text-slate-500">Preencha somente os dados necessários nesta primeira etapa.</p>

                <div className="mt-5 space-y-3">
                  <input className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-pink-400" placeholder="Seu nome *" value={contato.nome} onChange={evento => setContato({ ...contato, nome: evento.target.value })} />
                  <input className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-pink-400" inputMode="tel" placeholder="WhatsApp *" value={contato.celular} onChange={evento => setContato({ ...contato, celular: evento.target.value })} />
                  <input className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-pink-400" type="email" placeholder="E-mail *" value={contato.email} onChange={evento => setContato({ ...contato, email: evento.target.value })} />
                  <label className="block text-sm font-bold text-slate-700">Data do evento *
                    <input className="mt-1 w-full rounded-2xl border px-4 py-3 font-normal outline-none focus:border-pink-400" type="date" value={contato.data_evento} onChange={evento => setContato({ ...contato, data_evento: evento.target.value })} />
                  </label>
                  <input className="w-full rounded-2xl border px-4 py-3 outline-none focus:border-pink-400" placeholder="Tipo de evento (ex.: aniversário)" value={contato.tipo_evento} onChange={evento => setContato({ ...contato, tipo_evento: evento.target.value })} />
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1">
                    {(['Retirada', 'Entrega'] as const).map(opcao => (
                      <button key={opcao} type="button" onClick={() => setContato({ ...contato, modalidade: opcao })} className={`rounded-xl px-3 py-2.5 text-sm font-bold ${contato.modalidade === opcao ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-500'}`}>{opcao}</button>
                    ))}
                  </div>
                  <textarea className="min-h-24 w-full rounded-2xl border px-4 py-3 outline-none focus:border-pink-400" placeholder="Observações (opcional)" value={contato.observacoes} onChange={evento => setContato({ ...contato, observacoes: evento.target.value })} />
                  <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={contato.website} onChange={evento => setContato({ ...contato, website: evento.target.value })} />
                </div>

                {erro && <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{erro}</p>}

                <button type="submit" disabled={enviando || itens.length === 0} className="mt-5 w-full rounded-2xl bg-pink-600 px-5 py-3.5 font-black text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {enviando ? 'Enviando...' : 'Solicitar reserva'}
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-slate-500">Ao enviar, sua solicitação entra na nossa análise. A confirmação final depende da disponibilidade e da formalização da reserva.</p>
              </form>
            </aside>
          </div>
        )}
      </section>
    </main>
  )
}
