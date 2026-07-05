'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type OrdemServico = {
  id: string
  numero: string
  status: string | null
  responsavel: string | null
  data_prevista: string | null
  observacoes: string | null
}

type ItemOS = {
  id: string
  etapa: string
  descricao: string
  concluido: boolean
}

export function ReservaCentroOperacional({ reservaId }: { reservaId: string }) {
  const [os, setOs] = useState<OrdemServico | null>(null)
  const [itens, setItens] = useState<ItemOS[]>([])
  const [erro, setErro] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [dataPrevista, setDataPrevista] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [novaEtapa, setNovaEtapa] = useState('Separação')
  const [novaTarefa, setNovaTarefa] = useState('')

  async function carregar() {
    const { data: osData, error: osError } = await supabase
      .from('ordens_servico')
      .select('*')
      .eq('reserva_id', reservaId)
      .maybeSingle()

    if (osError) return setErro(osError.message)

    setOs(osData)

    if (osData) {
      setResponsavel(osData.responsavel || '')
      setDataPrevista(osData.data_prevista || '')
      setObservacoes(osData.observacoes || '')

      const { data: itensData, error: itensError } = await supabase
        .from('ordem_servico_itens')
        .select('*')
        .eq('ordem_servico_id', osData.id)
        .order('created_at', { ascending: true })

      if (itensError) return setErro(itensError.message)
      setItens(itensData || [])
    }
  }

  useEffect(() => {
    carregar()
  }, [reservaId])

  const progresso = useMemo(() => {
    if (itens.length === 0) return 0
    const feitos = itens.filter(i => i.concluido).length
    return Math.round((feitos / itens.length) * 100)
  }, [itens])

  async function timeline(titulo: string, descricao: string) {
    await supabase.from('reserva_timeline').insert({
      reserva_id: reservaId,
      titulo,
      descricao,
      tipo: 'Ordem de Serviço'
    })
  }

  async function criarOS() {
    setErro('')

    const numero = `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const { data, error } = await supabase
      .from('ordens_servico')
      .insert({
        reserva_id: reservaId,
        numero,
        status: 'Aberta',
        responsavel: responsavel || null,
        data_prevista: dataPrevista || null,
        observacoes: observacoes || null
      })
      .select('*')
      .single()

    if (error) return setErro(error.message)

    const tarefasPadrao = [
      { etapa: 'Separação', descricao: 'Separar todos os itens do kit' },
      { etapa: 'Separação', descricao: 'Conferir composição do kit' },
      { etapa: 'Separação', descricao: 'Registrar checklist antes da saída' },
      { etapa: 'Entrega', descricao: 'Carregar itens para transporte' },
      { etapa: 'Entrega', descricao: 'Confirmar entrega ao cliente' },
      { etapa: 'Devolução', descricao: 'Conferir itens devolvidos' },
      { etapa: 'Devolução', descricao: 'Registrar avarias ou pendências' },
      { etapa: 'Encerramento', descricao: 'Finalizar ordem de serviço' }
    ]

    await supabase.from('ordem_servico_itens').insert(
      tarefasPadrao.map(t => ({
        ordem_servico_id: data.id,
        etapa: t.etapa,
        descricao: t.descricao,
        concluido: false
      }))
    )

    await timeline('Ordem de Serviço criada', `A ${numero} foi criada para esta reserva.`)
    carregar()
  }

  async function salvarOS() {
    if (!os) return

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        responsavel: responsavel || null,
        data_prevista: dataPrevista || null,
        observacoes: observacoes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', os.id)

    if (error) return setErro(error.message)

    await timeline('Ordem de Serviço atualizada', 'Dados operacionais da OS foram atualizados.')
    carregar()
  }

  async function alternarTarefa(item: ItemOS) {
    const novo = !item.concluido

    const { error } = await supabase
      .from('ordem_servico_itens')
      .update({
        concluido: novo,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id)

    if (error) return setErro(error.message)

    await timeline(
      novo ? 'Tarefa concluída' : 'Tarefa reaberta',
      `${item.etapa}: ${item.descricao}`
    )

    carregar()
  }

  async function adicionarTarefa(e: React.FormEvent) {
    e.preventDefault()
    if (!os) return
    if (!novaTarefa.trim()) return setErro('Informe a descrição da tarefa.')

    const { error } = await supabase.from('ordem_servico_itens').insert({
      ordem_servico_id: os.id,
      etapa: novaEtapa,
      descricao: novaTarefa,
      concluido: false
    })

    if (error) return setErro(error.message)

    await timeline('Tarefa adicionada à OS', `${novaEtapa}: ${novaTarefa}`)
    setNovaTarefa('')
    carregar()
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Centro Operacional</h2>
      <p className="mt-1 text-sm text-slate-500">
        Controle a execução da reserva por Ordem de Serviço.
      </p>

      {erro && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {!os ? (
        <div className="mt-6 rounded-2xl border border-dashed p-6">
          <p className="mb-4 text-sm text-slate-500">
            Esta reserva ainda não possui Ordem de Serviço.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Responsável" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            <Input label="Data prevista" type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
            <div className="flex items-end">
              <Button onClick={criarOS}>Criar Ordem de Serviço</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border p-4">
              <p className="text-sm text-slate-500">Número</p>
              <p className="text-xl font-bold text-slate-900">{os.numero}</p>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-sm text-slate-500">Status</p>
              <p className="text-xl font-bold text-slate-900">{os.status}</p>
            </div>

            <div className="rounded-2xl border p-4">
              <p className="text-sm text-slate-500">Progresso</p>
              <p className="text-xl font-bold text-green-700">{progresso}%</p>
            </div>
          </div>

          <div className="h-3 w-full rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-pink-600"
              style={{ width: `${progresso}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Responsável" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            <Input label="Data prevista" type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} />
          </div>

          <Textarea label="Observações" value={observacoes} onChange={e => setObservacoes(e.target.value)} />

          <Button onClick={salvarOS}>Salvar OS</Button>

          <form onSubmit={adicionarTarefa} className="rounded-2xl border bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Adicionar tarefa</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select label="Etapa" value={novaEtapa} onChange={e => setNovaEtapa(e.target.value)}>
                <option>Separação</option>
                <option>Entrega</option>
                <option>Devolução</option>
                <option>Encerramento</option>
              </Select>

              <Input label="Tarefa" value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} />

              <div className="flex items-end">
                <Button type="submit">Adicionar</Button>
              </div>
            </div>
          </form>

          <div className="grid gap-4 md:grid-cols-2">
            {['Separação', 'Entrega', 'Devolução', 'Encerramento'].map(etapa => (
              <div key={etapa} className="rounded-2xl border p-4">
                <h3 className="font-semibold text-slate-900">{etapa}</h3>

                <div className="mt-3 space-y-2">
                  {itens.filter(i => i.etapa === etapa).map(item => (
                    <button
                      key={item.id}
                      onClick={() => alternarTarefa(item)}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        item.concluido ? 'bg-green-50 text-green-700 line-through' : 'bg-white text-slate-700'
                      }`}
                    >
                      {item.concluido ? '✓' : '○'} {item.descricao}
                    </button>
                  ))}

                  {itens.filter(i => i.etapa === etapa).length === 0 && (
                    <p className="text-sm text-slate-400">Nenhuma tarefa.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
