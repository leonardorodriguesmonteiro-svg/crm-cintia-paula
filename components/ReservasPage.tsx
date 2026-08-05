'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Cliente = { id: string; nome: string; whatsapp: string | null }
type Kit = { id: string; nome: string; codigo: string | null; valor: number | null }
type ReservaItem = {
  id?: string
  kit_id: string | null
  descricao: string
  quantidade: number
  valor_unitario: number
  subtotal?: number
  kits?: Kit | null
}

type LinhaForm = ReservaItem & { chave: string }

type Reserva = {
  id: string
  data_evento: string
  horario_evento: string | null
  endereco_evento: string | null
  valor_total: number | null
  valor_sinal: number | null
  status: string | null
  observacoes: string | null
  clientes: Cliente | null
  kits: Kit | null
  reserva_itens: ReservaItem[]
}

const vazio = {
  cliente_id: '',
  kit_id: '',
  data_evento: '',
  horario_evento: '',
  endereco_evento: '',
  valor_sinal: 0,
  status: 'Pendente',
  observacoes: ''
}

function chaveLinha() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function dataCurta(valor: string | null | undefined) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ReservasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [form, setForm] = useState(vazio)
  const [linhas, setLinhas] = useState<LinhaForm[]>([])
  const [kitAdicionar, setKitAdicionar] = useState('')
  const [descricaoAdicional, setDescricaoAdicional] = useState('')
  const [valorAdicional, setValorAdicional] = useState(0)
  const [ajustesPorKit, setAjustesPorKit] = useState<Record<string, number>>({})
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregarBase() {
    const [clientesRes, kitsRes, ajustesRes] = await Promise.all([
      supabase.from('clientes').select('id,nome,whatsapp').order('nome'),
      supabase.from('kits').select('id,nome,codigo,valor').order('nome'),
      supabase.from('kit_composicao').select('kit_id,valor_ajuste')
    ])

    if (clientesRes.error) setErro(clientesRes.error.message)
    else setClientes(clientesRes.data || [])

    if (kitsRes.error) setErro(kitsRes.error.message)
    else setKits(kitsRes.data || [])

    if (ajustesRes.error) setErro(ajustesRes.error.message)
    else {
      setAjustesPorKit((ajustesRes.data || []).reduce<Record<string, number>>((mapa, item) => {
        mapa[item.kit_id] = (mapa[item.kit_id] || 0) + Number(item.valor_ajuste || 0)
        return mapa
      }, {}))
    }
  }

  async function carregarReservas() {
    const { data, error } = await supabase
      .from('reservas')
      .select('id,data_evento,horario_evento,endereco_evento,valor_total,valor_sinal,status,observacoes,clientes(id,nome,whatsapp),kits(id,nome,codigo,valor),reserva_itens(id,kit_id,descricao,quantidade,valor_unitario,subtotal,kits(id,nome,codigo,valor))')
      .order('data_evento', { ascending: true })

    if (error) return setErro(error.message)
    setReservas((data as any) || [])
  }

  useEffect(() => {
    carregarBase()
    carregarReservas()
  }, [])

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase()
    return reservas.filter((reserva) =>
      [
        reserva.clientes?.nome,
        reserva.kits?.nome,
        ...(reserva.reserva_itens || []).map(item => item.descricao),
        reserva.status,
        reserva.data_evento,
        reserva.endereco_evento
      ].join(' ').toLowerCase().includes(termo)
    )
  }, [reservas, busca])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    if (!form.cliente_id) {
      setErro('Selecione um cliente.')
      setSalvando(false)
      return
    }

    if (!linhas.some(linha => linha.kit_id)) {
      setErro('Adicione pelo menos um kit à reserva.')
      setSalvando(false)
      return
    }

    if (!form.data_evento) {
      setErro('Informe a data do evento.')
      setSalvando(false)
      return
    }

    const { error: salvarError } = await supabase.rpc('salvar_reserva_com_itens', {
      p_reserva_id: editando,
      p_cliente_id: form.cliente_id,
      p_data_evento: form.data_evento,
      p_horario_evento: form.horario_evento || null,
      p_endereco_evento: form.endereco_evento || null,
      p_valor_sinal: Number(form.valor_sinal) || 0,
      p_status: form.status,
      p_observacoes: form.observacoes || null,
      p_itens: linhas.map(linha => ({
        kit_id: linha.kit_id,
        descricao: linha.descricao,
        quantidade: linha.kit_id ? 1 : Number(linha.quantidade) || 1,
        valor_unitario: Number(linha.valor_unitario) || 0
      }))
    })

    if (salvarError) {
      setErro(salvarError.message)
      setSalvando(false)
      return
    }

    setForm(vazio)
    setLinhas([])
    setEditando(null)
    setSalvando(false)
    carregarReservas()
  }

  function editar(reserva: Reserva) {
    setEditando(reserva.id)
    setForm({
      cliente_id: reserva.clientes?.id || '',
      kit_id: reserva.kits?.id || '',
      data_evento: reserva.data_evento || '',
      horario_evento: reserva.horario_evento || '',
      endereco_evento: reserva.endereco_evento || '',
      valor_sinal: reserva.valor_sinal || 0,
      status: reserva.status || 'Pendente',
      observacoes: reserva.observacoes || ''
    })
    const itens = reserva.reserva_itens?.length
      ? reserva.reserva_itens
      : reserva.kits
        ? [{
            kit_id: reserva.kits.id,
            descricao: reserva.kits.nome,
            quantidade: 1,
            valor_unitario: Number(reserva.valor_total || reserva.kits.valor || 0)
          }]
        : []
    setLinhas(itens.map(item => ({
      chave: chaveLinha(),
      kit_id: item.kit_id,
      descricao: item.descricao,
      quantidade: Number(item.quantidade || 1),
      valor_unitario: Number(item.valor_unitario || 0)
    })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir esta reserva?')) return
    const { error } = await supabase.from('reservas').delete().eq('id', id)
    if (error) return setErro(error.message)
    carregarReservas()
  }

  function adicionarKit() {
    const kit = kits.find(item => item.id === kitAdicionar)
    if (!kit) return setErro('Selecione o kit que deseja adicionar.')
    if (linhas.some(linha => linha.kit_id === kit.id)) return setErro('Este kit já foi adicionado à reserva.')

    setLinhas(atuais => [...atuais, {
      chave: chaveLinha(),
      kit_id: kit.id,
      descricao: kit.nome,
      quantidade: 1,
      valor_unitario: Math.max(Number(kit.valor || 0) + Number(ajustesPorKit[kit.id] || 0), 0)
    }])
    setKitAdicionar('')
    setErro('')
  }

  function adicionarItemLivre() {
    if (descricaoAdicional.trim().length < 2) return setErro('Descreva o adicional, composição ou desconto.')
    setLinhas(atuais => [...atuais, {
      chave: chaveLinha(),
      kit_id: null,
      descricao: descricaoAdicional.trim(),
      quantidade: 1,
      valor_unitario: Number(valorAdicional) || 0
    }])
    setDescricaoAdicional('')
    setValorAdicional(0)
    setErro('')
  }

  function atualizarLinha(chave: string, alteracoes: Partial<LinhaForm>) {
    setLinhas(atuais => atuais.map(linha => linha.chave === chave ? { ...linha, ...alteracoes } : linha))
  }

  function removerLinha(chave: string) {
    setLinhas(atuais => atuais.filter(linha => linha.chave !== chave))
  }

  const valorTotalCalculado = Math.max(linhas.reduce(
    (total, linha) => total + Number(linha.quantidade || 0) * Number(linha.valor_unitario || 0),
    0
  ), 0)

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Reservas</h1>
        <p className="text-slate-500">Cadastre e acompanhe as reservas dos kits.</p>
      </div>

      <Card>
        <form onSubmit={salvar} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editando ? 'Editar reserva' : 'Nova reserva'}
            </h2>
            <p className="text-sm text-slate-500">
              Selecione o cliente e monte a reserva com quantos kits, composições e ajustes forem necessários.
            </p>
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <Select label="Cliente *" value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">Selecione um cliente...</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-4 rounded-2xl border bg-slate-50 p-4">
            <div>
              <h3 className="font-semibold text-slate-900">Kits e itens da reserva</h3>
              <p className="text-sm text-slate-500">O preço sugerido do kit já considera os ajustes cadastrados em sua composição.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Select label="Adicionar kit" value={kitAdicionar} onChange={e => setKitAdicionar(e.target.value)}>
                <option value="">Selecione um kit...</option>
                {kits.map(kit => (
                  <option key={kit.id} value={kit.id}>
                    {kit.codigo ? `${kit.codigo} - ` : ''}{kit.nome} — {moeda(Math.max(Number(kit.valor || 0) + Number(ajustesPorKit[kit.id] || 0), 0))}
                  </option>
                ))}
              </Select>
              <Button type="button" className="self-end" onClick={adicionarKit}>Adicionar kit</Button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <Input label="Adicional, composição ou desconto" placeholder="Ex.: arranjo extra ou desconto promocional" value={descricaoAdicional} onChange={e => setDescricaoAdicional(e.target.value)} />
              <Input label="Valor (R$)" type="number" step="0.01" placeholder="Use negativo para desconto" value={valorAdicional} onChange={e => setValorAdicional(Number(e.target.value))} />
              <Button type="button" variant="secondary" className="self-end" onClick={adicionarItemLivre}>Adicionar ajuste</Button>
            </div>

            <div className="space-y-2">
              {linhas.map(linha => (
                <div key={linha.chave} className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[1fr_110px_150px_auto] md:items-end">
                  <Input label={linha.kit_id ? 'Kit' : 'Descrição'} disabled={Boolean(linha.kit_id)} value={linha.descricao} onChange={e => atualizarLinha(linha.chave, { descricao: e.target.value })} />
                  <Input label="Quantidade" type="number" min="0.01" step="0.01" disabled={Boolean(linha.kit_id)} value={linha.quantidade} onChange={e => atualizarLinha(linha.chave, { quantidade: Number(e.target.value) })} />
                  <Input label="Valor unitário (R$)" type="number" step="0.01" value={linha.valor_unitario} onChange={e => atualizarLinha(linha.chave, { valor_unitario: Number(e.target.value) })} />
                  <Button type="button" variant="danger" onClick={() => removerLinha(linha.chave)}>Remover</Button>
                </div>
              ))}
              {linhas.length === 0 && <p className="rounded-xl border border-dashed bg-white p-5 text-center text-sm text-slate-500">Adicione os kits e ajustes que fazem parte desta reserva.</p>}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-pink-50 px-4 py-3 text-pink-900">
              <span className="text-sm font-semibold">Total calculado automaticamente</span>
              <strong className="text-xl">{moeda(valorTotalCalculado)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Data do evento *" type="date" value={form.data_evento} onChange={e => setForm({ ...form, data_evento: e.target.value })} />
            <Input label="Horário" placeholder="Ex.: 14:00" value={form.horario_evento} onChange={e => setForm({ ...form, horario_evento: e.target.value })} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Pendente</option>
              <option>Confirmada</option>
              <option>Em andamento</option>
              <option>Concluída</option>
              <option>Cancelada</option>
            </Select>
          </div>

          <Input label="Endereço do evento" placeholder="Rua, número, bairro, cidade" value={form.endereco_evento} onChange={e => setForm({ ...form, endereco_evento: e.target.value })} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Valor do sinal" type="number" value={form.valor_sinal} onChange={e => setForm({ ...form, valor_sinal: Number(e.target.value) })} />
            <Input label="Valor total" value={moeda(valorTotalCalculado)} readOnly />
          </div>

          <Textarea label="Observações" placeholder="Detalhes da reserva..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar edição' : 'Criar reserva'}
            </Button>

            {editando && (
              <Button variant="secondary" onClick={() => { setEditando(null); setForm(vazio); setLinhas([]) }}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reservas cadastradas</h2>
            <p className="text-sm text-slate-500">{filtradas.length} reserva(s) encontrada(s)</p>
          </div>

          <Input placeholder="Buscar reserva..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filtradas.map(reserva => (
            <div key={reserva.id} className="rounded-2xl border p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {reserva.clientes?.nome || 'Cliente não informado'}
                </p>
                <p className="text-sm text-slate-500">
                  {(reserva.reserva_itens || []).filter(item => item.kit_id).map(item => item.kits?.nome || item.descricao).join(' + ') || reserva.kits?.nome || 'Kit não informado'} • {dataCurta(reserva.data_evento)}
                  {reserva.horario_evento ? ` às ${reserva.horario_evento}` : ''}
                </p>
                <p className="text-sm text-slate-600">
                  Total: {moeda(Number(reserva.valor_total || 0))} • Sinal: {moeda(Number(reserva.valor_sinal || 0))}
                </p>
                {reserva.endereco_evento && (
                  <p className="text-sm text-slate-600">Local: {reserva.endereco_evento}</p>
                )}
              </div>

              <div className="flex flex-col md:items-end gap-2">
                <span className="text-xs bg-pink-50 text-pink-700 rounded-full px-3 py-1 w-fit">
                  {reserva.status}
                </span>

                <div className="flex gap-2">
                  <Link href={`/reservas/${reserva.id}`}>
                    <Button>Abrir</Button>
                  </Link>

                  <Button variant="secondary" onClick={() => editar(reserva)}>
                    Editar
                  </Button>

                  <Button variant="danger" onClick={() => excluir(reserva.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtradas.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            Nenhuma reserva encontrada.
          </div>
        )}
      </Card>
    </div>
  )
}
