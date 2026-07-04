'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Logistica = {
  id: string
  etapa: string
  responsavel: string | null
  horario_previsto: string | null
  horario_realizado: string | null
  status: string | null
  observacoes: string | null
}

const vazio = {
  etapa: 'Separação',
  responsavel: '',
  horario_previsto: '',
  horario_realizado: '',
  status: 'Pendente',
  observacoes: ''
}

export function ReservaLogistica({ reservaId }: { reservaId: string }) {
  const [itens, setItens] = useState<Logistica[]>([])
  const [form, setForm] = useState(vazio)
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data, error } = await supabase
      .from('reserva_logistica')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: true })

    if (error) return setErro(error.message)
    setItens(data || [])
  }

  useEffect(() => {
    carregar()
  }, [reservaId])

  async function registrarTimeline(titulo: string, descricao: string) {
    await supabase.from('reserva_timeline').insert({
      reserva_id: reservaId,
      titulo,
      descricao,
      tipo: 'Logística'
    })
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    const { error } = await supabase.from('reserva_logistica').insert({
      reserva_id: reservaId,
      etapa: form.etapa,
      responsavel: form.responsavel || null,
      horario_previsto: form.horario_previsto || null,
      horario_realizado: form.horario_realizado || null,
      status: form.status,
      observacoes: form.observacoes || null
    })

    if (error) return setErro(error.message)

    await registrarTimeline(
      'Logística adicionada',
      `${form.etapa} cadastrada com status ${form.status}.`
    )

    setForm(vazio)
    carregar()
  }

  async function atualizarStatus(item: Logistica, status: string) {
    const horarioRealizado = status === 'Concluído'
      ? new Date().toISOString()
      : item.horario_realizado

    const { error } = await supabase
      .from('reserva_logistica')
      .update({
        status,
        horario_realizado: horarioRealizado,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id)

    if (error) return setErro(error.message)

    await registrarTimeline(
      'Logística atualizada',
      `${item.etapa} alterada para ${status}.`
    )

    carregar()
  }

  const etapas = ['Separação', 'Entrega', 'Devolução']

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Logística da Reserva</h2>
      <p className="mt-1 text-sm text-slate-500">Controle separação, entrega e devolução.</p>

      {erro && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <form onSubmit={adicionar} className="mt-4 space-y-4 rounded-2xl border bg-slate-50 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Select label="Etapa" value={form.etapa} onChange={e => setForm({ ...form, etapa: e.target.value })}>
            {etapas.map(e => <option key={e}>{e}</option>)}
          </Select>

          <Input label="Responsável" value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} />

          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option>Pendente</option>
            <option>Em andamento</option>
            <option>Concluído</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Horário previsto" type="datetime-local" value={form.horario_previsto} onChange={e => setForm({ ...form, horario_previsto: e.target.value })} />
          <Input label="Horário realizado" type="datetime-local" value={form.horario_realizado} onChange={e => setForm({ ...form, horario_realizado: e.target.value })} />
        </div>

        <Textarea label="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

        <Button type="submit">Adicionar logística</Button>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {etapas.map(etapa => (
          <div key={etapa} className="rounded-2xl border p-4">
            <h3 className="font-semibold text-slate-900">{etapa}</h3>

            <div className="mt-3 space-y-3">
              {itens.filter(i => i.etapa === etapa).map(item => (
                <div key={item.id} className="rounded-xl border bg-white p-3 text-sm">
                  <p className="font-semibold text-slate-900">{item.status}</p>
                  <p className="text-slate-500">Responsável: {item.responsavel || '-'}</p>
                  <p className="text-slate-500">Previsto: {item.horario_previsto ? new Date(item.horario_previsto).toLocaleString('pt-BR') : '-'}</p>
                  <p className="text-slate-500">Realizado: {item.horario_realizado ? new Date(item.horario_realizado).toLocaleString('pt-BR') : '-'}</p>
                  {item.observacoes && <p className="mt-1 text-slate-600">{item.observacoes}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => atualizarStatus(item, 'Em andamento')}>Iniciar</Button>
                    <Button onClick={() => atualizarStatus(item, 'Concluído')}>Concluir</Button>
                  </div>
                </div>
              ))}

              {itens.filter(i => i.etapa === etapa).length === 0 && (
                <p className="text-sm text-slate-400">Nenhum registro.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
