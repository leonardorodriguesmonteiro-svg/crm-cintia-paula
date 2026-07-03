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
}

const vazio = {
  cliente_id: '',
  kit_id: '',
  data_evento: '',
  horario_evento: '',
  endereco_evento: '',
  valor_total: 0,
  valor_sinal: 0,
  status: 'Pendente',
  observacoes: ''
}

export function ReservasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregarBase() {
    const clientesRes = await supabase.from('clientes').select('id,nome,whatsapp').order('nome')
    const kitsRes = await supabase.from('kits').select('id,nome,codigo,valor').order('nome')

    if (clientesRes.error) setErro(clientesRes.error.message)
    else setClientes(clientesRes.data || [])

    if (kitsRes.error) setErro(kitsRes.error.message)
    else setKits(kitsRes.data || [])
  }

  async function carregarReservas() {
    const { data, error } = await supabase
      .from('reservas')
      .select('id,data_evento,horario_evento,endereco_evento,valor_total,valor_sinal,status,observacoes,clientes(id,nome,whatsapp),kits(id,nome,codigo,valor)')
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

    if (!form.kit_id) {
      setErro('Selecione um kit.')
      setSalvando(false)
      return
    }

    if (!form.data_evento) {
      setErro('Informe a data do evento.')
      setSalvando(false)
      return
    }

    const payload = {
      ...form,
      valor_total: Number(form.valor_total) || 0,
      valor_sinal: Number(form.valor_sinal) || 0
    }

    const resposta = editando
      ? await supabase.from('reservas').update(payload).eq('id', editando)
      : await supabase.from('reservas').insert(payload)

    if (resposta.error) {
      setErro(resposta.error.message)
      setSalvando(false)
      return
    }

    setForm(vazio)
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
      valor_total: reserva.valor_total || 0,
      valor_sinal: reserva.valor_sinal || 0,
      status: reserva.status || 'Pendente',
      observacoes: reserva.observacoes || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir esta reserva?')) return
    const { error } = await supabase.from('reservas').delete().eq('id', id)
    if (error) return setErro(error.message)
    carregarReservas()
  }

  const kitSelecionado = kits.find(k => k.id === form.kit_id)

  function preencherValorDoKit() {
    if (!kitSelecionado) return
    setForm({ ...form, valor_total: Number(kitSelecionado.valor) || 0 })
  }

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
              Selecione cliente, kit, data, valores e status da reserva.
            </p>
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Cliente *" value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">Selecione um cliente...</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </Select>

            <Select label="Kit *" value={form.kit_id} onChange={e => setForm({ ...form, kit_id: e.target.value })}>
              <option value="">Selecione um kit...</option>
              {kits.map(kit => (
                <option key={kit.id} value={kit.id}>
                  {kit.codigo ? `${kit.codigo} - ` : ''}{kit.nome}
                </option>
              ))}
            </Select>
          </div>

          {kitSelecionado && (
            <div className="rounded-xl border bg-pink-50 p-4 text-sm text-pink-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <span>Valor cadastrado para este kit: <strong>R$ {Number(kitSelecionado.valor || 0).toFixed(2)}</strong></span>
              <Button type="button" variant="secondary" onClick={preencherValorDoKit}>
                Usar valor do kit
              </Button>
            </div>
          )}

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
            <Input label="Valor total" type="number" value={form.valor_total} onChange={e => setForm({ ...form, valor_total: Number(e.target.value) })} />
            <Input label="Valor do sinal" type="number" value={form.valor_sinal} onChange={e => setForm({ ...form, valor_sinal: Number(e.target.value) })} />
          </div>

          <Textarea label="Observações" placeholder="Detalhes da reserva..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar edição' : 'Criar reserva'}
            </Button>

            {editando && (
              <Button variant="secondary" onClick={() => { setEditando(null); setForm(vazio) }}>
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
                  {reserva.kits?.nome || 'Kit não informado'} • {reserva.data_evento}
                  {reserva.horario_evento ? ` às ${reserva.horario_evento}` : ''}
                </p>
                <p className="text-sm text-slate-600">
                  Total: R$ {Number(reserva.valor_total || 0).toFixed(2)} • Sinal: R$ {Number(reserva.valor_sinal || 0).toFixed(2)}
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
