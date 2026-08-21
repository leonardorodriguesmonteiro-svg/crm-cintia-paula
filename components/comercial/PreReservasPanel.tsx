'use client'

import { useEffect, useMemo, useState } from 'react'
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

  async function carregar() {
    setCarregando(true)
    const [preReservasRes, clientesRes, kitsRes, estoqueRes] = await Promise.all([
      supabase
        .from('oportunidades')
        .select('id,numero,cliente_id,nome_contato,celular,email,origem,interesse,data_evento,etapa,versao,recebida_em,oportunidade_itens(id,tipo,nome_snapshot,quantidade)')
        .in('etapa', [...statusPreReserva])
        .order('recebida_em', { ascending: false }),
      supabase.from('clientes').select('id,nome,whatsapp,email').order('nome'),
      supabase.from('kits').select('id,nome,codigo').neq('status', 'Inativo').order('nome'),
      supabase.from('estoque_itens').select('id,nome,codigo').neq('status', 'Inativo').order('nome')
    ])

    const falha = preReservasRes.error || clientesRes.error || kitsRes.error || estoqueRes.error
    if (falha) setErro(falha.message)
    else {
      setPreReservas((preReservasRes.data || []) as PreReserva[])
      setClientes(clientesRes.data || [])
      setKits(kitsRes.data || [])
      setEstoque(estoqueRes.data || [])
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

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

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {formAberto && (
        <Card className="border-pink-200">
          <form className="space-y-4" onSubmit={criar}>
            <div>
              <h3 className="font-bold text-slate-900">Dados mínimos da pré-reserva</h3>
              <p className="text-sm text-slate-500">CPF, endereço e dados contratuais serão solicitados somente após o aceite da proposta.</p>
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
                    {(item.oportunidade_itens || []).map(produto => (
                      <p key={produto.id} className="flex items-center gap-1.5">
                        <PackageCheck size={14} /> {Number(produto.quantidade)}× {produto.nome_snapshot}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => window.open(`https://wa.me/55${somenteDigitos(item.celular)}`, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold text-green-700">
                    <MessageCircle size={15} /> WhatsApp
                  </button>
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
              </article>
            )
          })}
          {!exibidas.length && <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-400">Nenhuma pré-reserva neste estado.</div>}
        </div>
      )}
    </section>
  )
}
