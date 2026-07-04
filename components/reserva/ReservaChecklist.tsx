'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type ItemChecklist = {
  id: string
  etapa: string
  item: string
  concluido: boolean
}

export function ReservaChecklist({ reservaId }: { reservaId: string }) {
  const [itens, setItens] = useState<ItemChecklist[]>([])
  const [etapa, setEtapa] = useState('Separação')
  const [item, setItem] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    const { data, error } = await supabase
      .from('reserva_checklist')
      .select('*')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: true })

    if (error) return setErro(error.message)
    setItens(data || [])
  }

  useEffect(() => {
    carregar()
  }, [reservaId])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!item.trim()) {
      setErro('Informe o item do checklist.')
      return
    }

    const { error } = await supabase.from('reserva_checklist').insert({
      reserva_id: reservaId,
      etapa,
      item,
      concluido: false
    })

    if (error) return setErro(error.message)

    await supabase.from('reserva_timeline').insert({
      reserva_id: reservaId,
      titulo: 'Item adicionado ao checklist',
      descricao: `${etapa}: ${item}`,
      tipo: 'Checklist'
    })

    setItem('')
    carregar()
  }

  async function alternar(itemChecklist: ItemChecklist) {
    const novoStatus = !itemChecklist.concluido

    const { error } = await supabase
      .from('reserva_checklist')
      .update({ concluido: novoStatus, updated_at: new Date().toISOString() })
      .eq('id', itemChecklist.id)

    if (error) return setErro(error.message)

    await supabase.from('reserva_timeline').insert({
      reserva_id: reservaId,
      titulo: novoStatus ? 'Checklist concluído' : 'Checklist reaberto',
      descricao: `${itemChecklist.etapa}: ${itemChecklist.item}`,
      tipo: 'Checklist'
    })

    carregar()
  }

  const etapas = ['Separação', 'Entrega', 'Devolução']

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Checklist Inteligente</h2>
      <p className="mt-1 text-sm text-slate-500">Controle separação, entrega e devolução da reserva.</p>

      {erro && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <form onSubmit={adicionar} className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select label="Etapa" value={etapa} onChange={e => setEtapa(e.target.value)}>
          {etapas.map(e => <option key={e}>{e}</option>)}
        </Select>

        <Input label="Item" placeholder="Ex.: Painel separado" value={item} onChange={e => setItem(e.target.value)} />

        <div className="flex items-end">
          <Button type="submit">Adicionar</Button>
        </div>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {etapas.map(etapaAtual => (
          <div key={etapaAtual} className="rounded-2xl border p-4">
            <h3 className="font-semibold text-slate-900">{etapaAtual}</h3>

            <div className="mt-3 space-y-2">
              {itens.filter(i => i.etapa === etapaAtual).map(i => (
                <button
                  key={i.id}
                  onClick={() => alternar(i)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    i.concluido ? 'bg-green-50 text-green-700 line-through' : 'bg-white text-slate-700'
                  }`}
                >
                  {i.concluido ? '✓' : '○'} {i.item}
                </button>
              ))}

              {itens.filter(i => i.etapa === etapaAtual).length === 0 && (
                <p className="text-sm text-slate-400">Nenhum item.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
