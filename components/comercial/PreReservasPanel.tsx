'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MessageCircle, PackageCheck, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  proximosStatusPreReserva,
  statusPreReserva,
  type StatusPreReserva
} from '@/lib/domain/comercial/jornadaComercial'
import { supabase } from '@/lib/supabase'

type Cliente = {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
}

type Catalogo = {
  id: string
  nome: string
  codigo: string | null
}

type ItemPreReserva = {
  id: string
  tipo: 'KIT' | 'ITEM_ESTOQUE'
  nome_snapshot: string
  quantidade: number
  valor_referencia: number | null
  observacoes: string | null
}

type PreReserva = {
  id: string
  numero: number
  cliente_id: string | null
  nome_contato: string
  celular: string
  email: string | null
  origem: string
  interesse: string | null
  data_evento: string | null
  etapa: StatusPreReserva
  versao: number
  cadastro_completo_em: string | null
  recebida_em: string
  oportunidade_itens: ItemPreReserva[]
}

const rotulos: Record<StatusPreReserva, string> = {
  RECEBIDA: 'Recebida',
  EM_ANALISE: 'Em análise',
  AJUSTE_SOLICITADO: 'Ajuste solicitado',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CONVERTIDA_EM_PROPOSTA: 'Proposta criada'
}

const cores: Record<StatusPreReserva, string> = {
  RECEBIDA: 'border-blue-200 bg-blue-50 text-blue-800',
  EM_ANALISE: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  AJUSTE_SOLICITADO: 'border-amber-200 bg-amber-50 text-amber-800',
  APROVADA: 'border-green-200 bg-green-50 text-green-800',
  RECUSADA: 'border-slate-300 bg-slate-100 text-slate-700',
  CONVERTIDA_EM_PROPOSTA: 'border-violet-200 bg-violet-50 text-violet-800'
}

function somenteDigitos(valor = '') {
  return valor.replace(/\D/g, '')
}

function formatarCelular(valor = '') {
  const digitos = somenteDigitos(valor).slice(0, 11)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 7) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`
  const inicioNumero = digitos.length === 11 ? 7 : 6
  return `${digitos.slice(0, 2)} ${digitos.slice(2, inicioNumero)}-${digitos.slice(inicioNumero)}`
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function valorDoPedido(itens: ItemPreReserva[]) {
  const semPreco = itens.some(item => item.valor_referencia === null || !Number.isFinite(Number(item.valor_referencia)))
  const subtotal = itens.reduce((soma, item) => soma + Number(item.quantidade) * Number(item.valor_referencia || 0), 0)
  return { subtotal, semPreco }
}

function dataCurta(valor: string | null) {
  if (!valor) return 'Não informada'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

export function PreReservasPanel() {
  const [preReservas, setPreReservas] = useState<PreReserva[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [kits, setKits] = useState<Catalogo[]>([])
  const [estoque, setEstoque] = useState<Catalogo[]>([])
  const [filtro, setFiltro] = useState<StatusPreReserva | 'TODAS'>('TODAS')
  const [formAberto, setFormAberto] = useState(false)
  const [pedidoAberto, setPedidoAberto] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [idempotencia, setIdempotencia] = useState('')
  const [form, setForm] = useState({
    cliente_id: '',
    nome: '',
    celular: '',
    email: '',
    data_evento: '',
    interesse: '',
    item: '',
    quantidade: '1',
    observacoes_item: ''
  })

  const [atualizando, setAtualizando] = useState(false)
  const [erroCarga, setErroCarga] = useState('')
  const [avisoCadastros, setAvisoCadastros] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const [linkCliente, setLinkCliente] = useState<{ id: string; url: string; whatsappDisponivel: boolean; envios: { canal: string; status: string }[] } | null>(null)
  const [gerandoLink, setGerandoLink] = useState<string | null>(null)
  const cargaAtiva = useRef(false)
  const montado = useRef(true)

  const carregar = useCallback(async () => {
    if (cargaAtiva.current) return
    cargaAtiva.current = true
    setAtualizando(true)
    try {
      const resultados = await Promise.allSettled([
        supabase.from('oportunidades')
          .select('id,numero,cliente_id,nome_contato,celular,email,origem,interesse,data_evento,etapa,versao,recebida_em,cadastro_completo_em,oportunidade_itens(id,tipo,nome_snapshot,quantidade,valor_referencia,observacoes)')
          .in('etapa', [...statusPreReserva]).order('recebida_em', { ascending: false }),
        supabase.from('clientes').select('id,nome,whatsapp,email').order('nome'),
        supabase.from('kits').select('id,nome,codigo').neq('status', 'Inativo').order('nome'),
        supabase.from('estoque_itens').select('id,nome,codigo').neq('status', 'Inativo').order('nome')
      ])
      if (!montado.current) return
      const pedidos = resultados[0]
      if (pedidos.status === 'fulfilled' && !pedidos.value.error) {
        setPreReservas((pedidos.value.data || []) as PreReserva[])
        setErroCarga('')
        setUltimaAtualizacao(new Date())
      } else {
        setErroCarga('Não foi possível atualizar as pré-reservas. Os dados anteriores foram mantidos. Tente atualizar ou entre novamente no ERP.')
      }
      const setters = [setClientes, setKits, setEstoque]
      const nomes = ['clientes', 'kits', 'estoque']
      const falhas: string[] = []
      resultados.slice(1).forEach((resultado, i) => {
        if (resultado.status === 'fulfilled' && !resultado.value.error) {
          setters[i]((resultado.value.data || []) as any)
        } else falhas.push(nomes[i])
      })
      setAvisoCadastros(falhas.length ? `Não foi possível atualizar ${falhas.join(', ')}. As pré-reservas são carregadas separadamente.` : '')
    } catch {
      if (montado.current) setErroCarga('Falha de conexão. Tente atualizar novamente.')
    } finally {
      cargaAtiva.current = false
      if (montado.current) { setAtualizando(false); setCarregando(false) }
    }
  }, [])

  useEffect(() => {
    montado.current = true
    void carregar()
    const atualizarVisivel = () => { if (document.visibilityState === 'visible') void carregar() }
    const intervalo = window.setInterval(atualizarVisivel, 30000)
    window.addEventListener('focus', atualizarVisivel)
    document.addEventListener('visibilitychange', atualizarVisivel)
    return () => {
      montado.current = false
      window.clearInterval(intervalo)
      window.removeEventListener('focus', atualizarVisivel)
      document.removeEventListener('visibilitychange', atualizarVisivel)
    }
  }, [carregar])

  async function gerenciarLink(item: PreReserva, acao = 'consultar') {
    const revogar = acao === 'revogar'
    if ((revogar || acao === 'substituir') && !window.confirm(revogar ? 'Revogar o link deste pedido?' : 'Substituir o link? O anterior deixará de funcionar.')) return
    setGerandoLink(item.id)
    setErro('')
    setLinkCliente(null)
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Entre novamente no ERP.')
      const resposta = await fetch(`/api/comercial/pre-reservas/${item.id}/acompanhamento`, {
        method: revogar ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
        ...(revogar ? {} : { body: JSON.stringify({ acao }) })
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível gerenciar o link.')
      if (!revogar) setLinkCliente({ id: item.id, url: corpo.url, whatsappDisponivel: corpo.whatsapp_disponivel === true, envios: corpo.envios || [] })
    } catch (error) { setErro(error instanceof Error ? error.message : 'Falha ao gerenciar o link.') }
    finally { setGerandoLink(null) }
  }

  const exibidas = useMemo(
    () => filtro === 'TODAS'
      ? preReservas
      : preReservas.filter(item => item.etapa === filtro),
    [filtro, preReservas]
  )

  function abrirFormulario() {
    setIdempotencia(crypto.randomUUID())
    setFormAberto(true)
    setErro('')
  }

  function selecionarCliente(clienteId: string) {
    const cliente = clientes.find(item => item.id === clienteId)
    setForm(atual => ({
      ...atual,
      cliente_id: clienteId,
      nome: cliente?.nome || '',
      celular: formatarCelular(cliente?.whatsapp || ''),
      email: cliente?.email || ''
    }))
  }

  async function criar(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')

    const { data: sessao } = await supabase.auth.getSession()
    const token = sessao.session?.access_token
    const [tipo, id] = form.item.split(':')

    if (!token) {
      setErro('Sua sessão expirou. Entre novamente no ERP.')
      setSalvando(false)
      return
    }

    const resposta = await fetch('/api/comercial/pre-reservas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        cliente_id: form.cliente_id || null,
        nome: form.nome,
        celular: form.celular,
        email: form.email || null,
        data_evento: form.data_evento || null,
        interesse: form.interesse || null,
        idempotencia,
        itens: [{
          tipo,
          id,
          quantidade: Number(form.quantidade),
          observacoes: form.observacoes_item || null
        }]
      })
    })
    const dados = await resposta.json().catch(() => ({}))

    if (!resposta.ok) {
      setErro(dados.erro || 'Não foi possível criar a pré-reserva.')
      setSalvando(false)
      return
    }

    setForm({
      cliente_id: '', nome: '', celular: '', email: '', data_evento: '',
      interesse: '', item: '', quantidade: '1', observacoes_item: ''
    })
    setFormAberto(false)
    setSalvando(false)
    await carregar()
  }

  async function transicionar(item: PreReserva, proximoStatus: StatusPreReserva) {
    const exigeMotivo = ['AJUSTE_SOLICITADO', 'RECUSADA'].includes(proximoStatus)
    const observacao = exigeMotivo
      ? window.prompt('Registre o motivo desta decisão:')?.trim()
      : null
    if (exigeMotivo && !observacao) return

    setErro('')
    const { data: sessao } = await supabase.auth.getSession()
    const token = sessao.session?.access_token
    if (!token) return setErro('Sua sessão expirou. Entre novamente no ERP.')

    const resposta = await fetch(`/api/comercial/pre-reservas/${item.id}/transicoes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        proximo_status: proximoStatus,
        versao: item.versao,
        observacao
      })
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
      setErro(dados.erro || 'Não foi possível atualizar a pré-reserva.')
      return
    }
    await carregar()
    if (dados.aviso) setErro(dados.aviso)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-pink-100 bg-gradient-to-r from-pink-50 to-white p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-pink-700">Nova jornada</p>
          <h2 className="text-xl font-bold text-slate-900">Pré-reservas</h2>
          <p className="text-sm text-slate-600">Entrada mínima, análise da empresa e decisão antes da proposta.</p>
        </div>
        <Button onClick={abrirFormulario} className="flex items-center justify-center gap-2">
          <Plus size={17} /> Nova pré-reserva
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Button variant="secondary" onClick={() => void carregar()} disabled={atualizando}>{atualizando ? 'Atualizando…' : 'Atualizar pré-reservas'}</Button>
        <span role="status">{ultimaAtualizacao ? `Atualizado às ${ultimaAtualizacao.toLocaleTimeString('pt-BR')}. Atualização automática a cada 30 segundos.` : 'Aguardando carregamento.'}</span>
      </div>
      {erroCarga && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{erroCarga}</p>}
      {avisoCadastros && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{avisoCadastros}</p>}
      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {formAberto && (
        <Card className="border-pink-200">
          <form className="space-y-4" onSubmit={criar}>
            <div>
              <h3 className="font-bold text-slate-900">Dados mínimos da pré-reserva</h3>
              <p className="text-sm text-slate-500">CPF ou CNPJ, endereço e dados contratuais serão solicitados somente após o aceite da proposta.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select label="Cliente já cadastrado" value={form.cliente_id} onChange={evento => selecionarCliente(evento.target.value)}>
                <option value="">Novo interessado</option>
                {clientes.map(cliente => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
              </Select>
              <Input label="Nome *" value={form.nome} onChange={evento => setForm({ ...form, nome: evento.target.value })} />
              <Input label="Celular com DDD *" inputMode="tel" value={form.celular} onChange={evento => setForm({ ...form, celular: formatarCelular(evento.target.value) })} />
              <Input label="E-mail" type="email" value={form.email} onChange={evento => setForm({ ...form, email: evento.target.value })} />
              <Input label="Data do evento" type="date" value={form.data_evento} onChange={evento => setForm({ ...form, data_evento: evento.target.value })} />
              <Input label="Tema ou interesse" value={form.interesse} onChange={evento => setForm({ ...form, interesse: evento.target.value })} />
              <Select label="Kit ou item solicitado *" value={form.item} onChange={evento => setForm({ ...form, item: evento.target.value })}>
                <option value="">Selecione</option>
                <optgroup label="Kits prontos">
                  {kits.map(item => <option key={`KIT:${item.id}`} value={`KIT:${item.id}`}>{item.codigo} — {item.nome}</option>)}
                </optgroup>
                <optgroup label="Itens para kit personalizado">
                  {estoque.map(item => <option key={`ITEM_ESTOQUE:${item.id}`} value={`ITEM_ESTOQUE:${item.id}`}>{item.codigo} — {item.nome}</option>)}
                </optgroup>
              </Select>
              <Input label="Quantidade *" type="number" min="1" step="1" value={form.quantidade} onChange={evento => setForm({ ...form, quantidade: evento.target.value })} />
              <Input label="Observação do item" value={form.observacoes_item} onChange={evento => setForm({ ...form, observacoes_item: evento.target.value })} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={salvando}>{salvando ? 'Registrando...' : 'Registrar pré-reserva'}</Button>
              <Button variant="secondary" onClick={() => setFormAberto(false)} disabled={salvando}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setFiltro('TODAS')} className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-bold ${filtro === 'TODAS' ? 'border-pink-600 bg-pink-600 text-white' : 'bg-white text-slate-600'}`}>
          Todas ({preReservas.length})
        </button>
        {statusPreReserva.map(status => (
          <button key={status} type="button" onClick={() => setFiltro(status)} className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs font-bold ${filtro === status ? 'border-pink-600 bg-pink-600 text-white' : 'bg-white text-slate-600'}`}>
            {rotulos[status]} ({preReservas.filter(item => item.etapa === status).length})
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Carregando pré-reservas...</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {exibidas.map(item => {
            const acoes = proximosStatusPreReserva(item.etapa)
              .filter(status => status !== 'CONVERTIDA_EM_PROPOSTA')
            const { subtotal, semPreco } = valorDoPedido(item.oportunidade_itens || [])
            return (
              <article key={item.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-pink-700">PRÉ-{String(item.numero).padStart(4, '0')}</p>
                    <h3 className="truncate font-bold text-slate-900">{item.nome_contato}</h3>
                    <p className="truncate text-sm text-slate-500">{item.interesse || 'Interesse não informado'}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${cores[item.etapa]}`}>{rotulos[item.etapa]}</span>
                </div>

                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5"><CalendarDays size={14} /> Evento: {dataCurta(item.data_evento)}</p>
                  <p>Origem: {item.origem}</p>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <strong className="text-sm text-slate-900">Itens do pedido</strong>
                      <button type="button" aria-expanded={pedidoAberto === item.id} onClick={() => setPedidoAberto(atual => atual === item.id ? null : item.id)} className="rounded-lg border border-pink-200 bg-white px-3 py-2 font-bold text-pink-700">
                        {pedidoAberto === item.id ? 'Fechar detalhes' : 'Visualizar pedido'}
                      </button>
                    </div>
                    {(item.oportunidade_itens || []).map(produto => (
                      <div key={produto.id} className="flex items-start justify-between gap-3 border-b border-slate-200 py-2 last:border-0">
                        <span className="flex min-w-0 items-start gap-1.5"><PackageCheck size={14} className="mt-0.5 shrink-0" /> {Number(produto.quantidade)}× {produto.nome_snapshot}</span>
                        <span className="shrink-0 text-right font-semibold">{produto.valor_referencia === null ? 'Preço a definir' : moeda(Number(produto.quantidade) * Number(produto.valor_referencia))}</span>
                      </div>
                    ))}
                    <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-bold text-slate-900">
                      <span>{semPreco ? 'Subtotal parcial' : 'Total de referência'}</span><span>{moeda(subtotal)}</span>
                    </div>
                    {semPreco && <p className="mt-2 text-xs font-semibold text-amber-800">Há itens sem preço cadastrado. Defina seus valores antes de enviar a proposta.</p>}
                    {pedidoAberto === item.id && (
                      <div className="mt-3 space-y-2 rounded-lg border border-pink-100 bg-white p-3 text-sm">
                        <p><strong>Contato:</strong> {item.nome_contato} · {item.celular}</p>
                        <p><strong>E-mail:</strong> {item.email || 'Não informado'}</p>
                        <p><strong>Evento:</strong> {dataCurta(item.data_evento)} · {item.interesse || 'Sem descrição adicional'}</p>
                        {(item.oportunidade_itens || []).map(produto => (
                          <p key={produto.id}><strong>{produto.nome_snapshot}:</strong> {Number(produto.quantidade)} × {produto.valor_referencia === null ? 'Preço a definir' : moeda(Number(produto.valor_referencia))}{produto.observacoes ? ` · ${produto.observacoes}` : ''}</p>
                        ))}
                        <p className="text-xs text-slate-500">Valores de referência sujeitos a revisão na proposta. Nenhum desconto é aplicado nesta etapa.</p>
                      </div>
                    )}
                  </div>
                </div>

                {['APROVADA', 'CONVERTIDA_EM_PROPOSTA'].includes(item.etapa) && <p className="mt-3 text-sm font-semibold text-pink-700">{item.cadastro_completo_em ? 'Cadastro completo — pronto para orçamento' : 'Cadastro pendente — envie o link ao cliente'}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => window.open(`https://wa.me/55${somenteDigitos(item.celular)}`, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold text-green-700">
                    <MessageCircle size={15} /> WhatsApp
                  </button>
                  <Button variant="secondary" disabled={gerandoLink === item.id} onClick={() => void gerenciarLink(item)}>Ver / copiar link do cliente</Button>
                  <Button variant="secondary" disabled={gerandoLink === item.id} onClick={() => void gerenciarLink(item, 'revogar')}>Revogar link</Button>
                  <Button variant="secondary" disabled={gerandoLink === item.id} onClick={() => void gerenciarLink(item, 'substituir')}>Substituir link</Button>
                  {acoes.map(status => (
                    <Button key={status} variant="secondary" className="px-3 py-2 text-xs" onClick={() => transicionar(item, status)}>
                      {rotulos[status]}
                    </Button>
                  ))}
                  {item.etapa === 'APROVADA' && (
                    <Link href={`/orcamentos?oportunidade=${item.id}`} className="rounded-xl bg-pink-600 px-3 py-2 text-xs font-bold text-white">
                      Preparar proposta
                    </Link>
                  )}
                </div>
                {linkCliente?.id === item.id && <div className="mt-4 space-y-3 rounded-xl border border-pink-200 bg-pink-50 p-4">
                  <p className="font-bold">Link privado do cliente</p>
                  <input aria-label={`Link do pedido ${item.numero}`} readOnly value={linkCliente.url} onFocus={e => e.target.select()} className="w-full rounded-lg border p-3 text-sm" />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(linkCliente.url) } catch { setErro('Selecione o link acima e copie manualmente.') } }}>Copiar link</Button>
                    <a className="rounded-xl border bg-white px-3 py-2 text-sm font-bold text-green-700" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${somenteDigitos(item.celular).length <= 11 ? '55' : ''}${somenteDigitos(item.celular)}?text=${encodeURIComponent(['APROVADA', 'CONVERTIDA_EM_PROPOSTA'].includes(item.etapa) ? `Sua pré-reserva #${item.numero} foi aprovada! Complete seu cadastro para prepararmos o orçamento final: ${linkCliente.url}. A reserva depende da formalização.` : `Olá! Acompanhe seu pedido #${item.numero} da Cintia Paula: ${linkCliente.url}`)}`}>Abrir WhatsApp com link</a>
                    <Button variant="secondary" disabled={gerandoLink === item.id} onClick={() => void gerenciarLink(item, 'enviar_email')}>Enviar link por e-mail</Button>
                    {linkCliente.whatsappDisponivel && <Button variant="secondary" disabled={gerandoLink === item.id} onClick={() => void gerenciarLink(item, 'enviar_whatsapp')}>Enviar WhatsApp automático</Button>}
                  </div>
                  <p className="text-xs text-slate-600">O WhatsApp acima abre uma mensagem para você revisar e enviar. O link pode ser consultado novamente aqui.</p>
                  {linkCliente.envios.length === 0 && <p className="text-sm">Nenhum envio automático registrado.</p>}
                  {linkCliente.envios.map((envio, indice) => <p key={indice} className="text-sm">{envio.canal === 'email' ? 'E-mail' : 'WhatsApp'}: {({ aceito: 'Aceito pelo serviço (entrega não confirmada)', nao_configurado: 'Serviço ainda não configurado', sem_consentimento: 'Cliente não autorizou WhatsApp automático', sem_destino: 'Contato ausente ou inválido', falhou: 'Envio recusado; confira o serviço antes de tentar novamente', incerto: 'Resultado incerto; confira o serviço antes de repetir', processando: 'Envio iniciado; se persistir, confira o serviço', pendente: 'Aguardando envio' } as Record<string, string>)[envio.status] || envio.status}</p>)}
                </div>}
              </article>
            )
          })}
          {!exibidas.length && !erroCarga && <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-400">Nenhuma pré-reserva neste estado.</div>}
        </div>
      )}
    </section>
  )
}
