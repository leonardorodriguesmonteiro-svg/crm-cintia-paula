'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

const abas = ['Resumo', 'Timeline', 'Financeiro', 'Kit', 'Checklist', 'Contrato']

export function ReservaDetalhePage({ id }: { id: string }) {
  const [aba, setAba] = useState('Resumo')
  const [reserva, setReserva] = useState<any>(null)
  const [recebimentos, setRecebimentos] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [composicao, setComposicao] = useState<any[]>([])
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [valorRecebido, setValorRecebido] = useState(0)
  const [formaPagamento, setFormaPagamento] = useState('Pix')

  const [form, setForm] = useState({
    data_evento: '',
    horario_evento: '',
    endereco_evento: '',
    status: 'Pendente',
    observacoes: ''
  })

  async function registrarTimeline(titulo: string, descricao = '', tipo = 'Sistema') {
    await supabase.from('reserva_timeline').insert({
      reserva_id: id,
      titulo,
      descricao,
      tipo
    })
  }

  async function carregar() {
    const reservaRes = await supabase.from('reservas').select('*,clientes(*),kits(*)').eq('id', id).single()
    const recebimentosRes = await supabase.from('recebimentos').select('*').eq('reserva_id', id).order('created_at', { ascending: false })
    const timelineRes = await supabase.from('reserva_timeline').select('*').eq('reserva_id', id).order('created_at', { ascending: false })

    if (reservaRes.error) return setErro(reservaRes.error.message)

    setReserva(reservaRes.data)
    setForm({
      data_evento: reservaRes.data.data_evento || '',
      horario_evento: reservaRes.data.horario_evento || '',
      endereco_evento: reservaRes.data.endereco_evento || '',
      status: reservaRes.data.status || 'Pendente',
      observacoes: reservaRes.data.observacoes || ''
    })

    if (!recebimentosRes.error) setRecebimentos(recebimentosRes.data || [])
    if (!timelineRes.error) setTimeline(timelineRes.data || [])

    if (reservaRes.data.kit_id) {
      const compRes = await supabase
        .from('kit_composicao')
        .select('quantidade,observacoes,estoque_itens(nome,codigo,categoria,quantidade_disponivel)')
        .eq('kit_id', reservaRes.data.kit_id)

      if (!compRes.error) setComposicao(compRes.data || [])
    }
  }

  useEffect(() => {
    carregar()
  }, [id])

  if (erro) return <div className="p-8 text-red-700">{erro}</div>
  if (!reserva) return <div className="p-8 text-slate-500">Carregando reserva...</div>

  const valorTotal = Number(reserva.valor_total || 0)
  const recebido = recebimentos.reduce((t, r) => t + Number(r.valor || 0), 0)
  const saldo = Math.max(valorTotal - recebido, 0)

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    const statusAnterior = reserva.status

    const { error } = await supabase.from('reservas').update(form).eq('id', id)

    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }

    await registrarTimeline(
      'Reserva editada',
      statusAnterior !== form.status ? `Status alterado de ${statusAnterior} para ${form.status}.` : 'Dados da reserva atualizados.',
      'Edição'
    )

    setEditando(false)
    setSalvando(false)
    carregar()
  }

  async function registrarRecebimento(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    if (valorRecebido <= 0) {
      setErro('Informe um valor recebido maior que zero.')
      setSalvando(false)
      return
    }

    if (valorRecebido > saldo) {
      setErro('O valor recebido não pode ser maior que o saldo da reserva.')
      setSalvando(false)
      return
    }

    const { error } = await supabase.from('recebimentos').insert({
      reserva_id: id,
      valor: valorRecebido,
      data_recebimento: new Date().toISOString().slice(0, 10),
      forma_pagamento: formaPagamento,
      status: 'Pago',
      observacoes: 'Recebimento registrado pelo Centro da Reserva.'
    })

    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }

    await registrarTimeline(
      'Recebimento registrado',
      `Recebimento de R$ ${valorRecebido.toFixed(2)} via ${formaPagamento}.`,
      'Financeiro'
    )

    setValorRecebido(0)
    setFormaPagamento('Pix')
    setSalvando(false)
    carregar()
  }

  const whatsapp = reserva.clientes?.whatsapp
    ? `https://wa.me/55${String(reserva.clientes.whatsapp).replace(/\D/g, '')}`
    : null

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <Link href="/reservas" className="text-sm font-semibold text-pink-700">← Voltar para Reservas</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Centro da Reserva</h1>
          <p className="text-slate-500">{reserva.clientes?.nome || 'Cliente'} • {reserva.kits?.nome || 'Kit'}</p>
        </div>

        <div className="flex gap-2">
          {whatsapp && <a href={whatsapp} target="_blank"><Button variant="secondary">WhatsApp</Button></a>}
          <Button onClick={() => setEditando(!editando)}>{editando ? 'Cancelar edição' : 'Editar reserva'}</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-slate-500">Valor contratado</p><p className="mt-2 text-3xl font-bold">R$ {valorTotal.toFixed(2)}</p></Card>
        <Card><p className="text-sm text-slate-500">Recebido</p><p className="mt-2 text-3xl font-bold text-green-700">R$ {recebido.toFixed(2)}</p></Card>
        <Card><p className="text-sm text-slate-500">Saldo</p><p className="mt-2 text-3xl font-bold text-yellow-700">R$ {saldo.toFixed(2)}</p></Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2">
          {abas.map(item => (
            <button
              key={item}
              onClick={() => setAba(item)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${aba === item ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {editando && (
        <Card>
          <form onSubmit={salvarEdicao} className="space-y-4">
            <h2 className="text-lg font-semibold">Editar dados da reserva</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Data do evento" type="date" value={form.data_evento} onChange={e => setForm({ ...form, data_evento: e.target.value })} />
              <Input label="Horário" value={form.horario_evento} onChange={e => setForm({ ...form, horario_evento: e.target.value })} />
              <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option>Pendente</option><option>Confirmada</option><option>Em andamento</option><option>Concluída</option><option>Cancelada</option>
              </Select>
            </div>
            <Input label="Endereço do evento" value={form.endereco_evento} onChange={e => setForm({ ...form, endereco_evento: e.target.value })} />
            <Textarea label="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</Button>
          </form>
        </Card>
      )}

      {aba === 'Resumo' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card><h2 className="text-lg font-semibold">Cliente</h2><div className="mt-4 space-y-2 text-sm text-slate-600"><p><strong>Nome:</strong> {reserva.clientes?.nome || '-'}</p><p><strong>WhatsApp:</strong> {reserva.clientes?.whatsapp || '-'}</p><p><strong>Instagram:</strong> {reserva.clientes?.instagram || '-'}</p><p><strong>Email:</strong> {reserva.clientes?.email || '-'}</p></div></Card>
          <Card><h2 className="text-lg font-semibold">Evento</h2><div className="mt-4 space-y-2 text-sm text-slate-600"><p><strong>Data:</strong> {reserva.data_evento || '-'}</p><p><strong>Horário:</strong> {reserva.horario_evento || '-'}</p><p><strong>Status:</strong> {reserva.status || '-'}</p><p><strong>Endereço:</strong> {reserva.endereco_evento || '-'}</p><p><strong>Observações:</strong> {reserva.observacoes || '-'}</p></div></Card>
        </div>
      )}

      {aba === 'Timeline' && (
        <Card>
          <h2 className="text-lg font-semibold">Timeline da Reserva</h2>
          <div className="mt-4 space-y-3">
            {timeline.map(item => (
              <div key={item.id} className="rounded-2xl border p-4">
                <p className="font-semibold">{item.titulo}</p>
                <p className="text-sm text-slate-500">{new Date(item.created_at).toLocaleString('pt-BR')} • {item.tipo}</p>
                {item.descricao && <p className="mt-1 text-sm text-slate-600">{item.descricao}</p>}
              </div>
            ))}
            {timeline.length === 0 && <p className="text-sm text-slate-500">Nenhum evento registrado ainda.</p>}
          </div>
        </Card>
      )}

      {aba === 'Financeiro' && (
        <Card>
          <h2 className="text-lg font-semibold">Financeiro</h2>
          <form onSubmit={registrarRecebimento} className="mt-4 space-y-4 rounded-2xl border bg-slate-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Valor recebido" type="number" value={valorRecebido} onChange={e => setValorRecebido(Number(e.target.value))} />
              <Select label="Forma de pagamento" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
                <option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>Transferência</option><option>Boleto</option>
              </Select>
            </div>
            <Button type="submit" disabled={salvando || saldo <= 0}>{salvando ? 'Registrando...' : saldo <= 0 ? 'Reserva quitada' : 'Registrar recebimento'}</Button>
          </form>

          <div className="mt-4 space-y-3">
            {recebimentos.map(item => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">R$ {Number(item.valor || 0).toFixed(2)}</p>
                <p className="text-slate-500">{item.forma_pagamento || '-'} • {item.data_recebimento || '-'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {aba === 'Kit' && (
        <Card>
          <h2 className="text-lg font-semibold">Kit e composição</h2>
          <p className="mt-2 text-sm text-slate-600"><strong>Kit:</strong> {reserva.kits?.nome || '-'}</p>
          <div className="mt-4 space-y-2">
            {composicao.map((item, index) => (
              <div key={index} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{item.estoque_itens?.nome || 'Item'}</p>
                <p className="text-slate-500">Quantidade no kit: {item.quantidade} • Disponível: {item.estoque_itens?.quantidade_disponivel ?? 0}</p>
              </div>
            ))}
            {composicao.length === 0 && <p className="text-sm text-slate-500">Este kit ainda não possui composição cadastrada.</p>}
          </div>
        </Card>
      )}

      {aba === 'Checklist' && <Card><h2 className="text-lg font-semibold">Checklist</h2><p className="mt-2 text-sm text-slate-500">Checklist de separação, entrega e devolução será implementado na próxima etapa.</p></Card>}

      {aba === 'Contrato' && <Card><h2 className="text-lg font-semibold">Contrato</h2><p className="mt-2 text-sm text-slate-500">Geração de contrato em PDF será implementada na próxima etapa.</p></Card>}
    </div>
  )
}
