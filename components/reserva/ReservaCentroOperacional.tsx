'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ReservaEquipeOS } from '@/components/reserva/ReservaEquipeOS'

type OrdemServico = {
  id: string
  numero: string
  status: string | null
  responsavel: string | null
  cliente_nome: string | null
  data_prevista: string | null
  data_retirada: string | null
  horario_retirada: string | null
  observacoes: string | null
}

type ItemOS = {
  id: string
  etapa: string
  descricao: string
  concluido: boolean
}

type ReservaOperacional = {
  data_retirada: string | null
  horario_retirada: string | null
  data_evento: string | null
  clientes: { nome: string } | { nome: string }[] | null
}

function nomeClienteDaReserva(reserva: ReservaOperacional | null) {
  if (!reserva?.clientes) return ''
  return Array.isArray(reserva.clientes)
    ? reserva.clientes[0]?.nome || ''
    : reserva.clientes.nome || ''
}

export function ReservaCentroOperacional({ reservaId }: { reservaId: string }) {
  const [os, setOs] = useState<OrdemServico | null>(null)
  const [itens, setItens] = useState<ItemOS[]>([])
  const [erro, setErro] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [dataRetirada, setDataRetirada] = useState('')
  const [horarioRetirada, setHorarioRetirada] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [novaEtapa, setNovaEtapa] = useState('Separação')
  const [novaTarefa, setNovaTarefa] = useState('')

  async function carregar() {
    setErro('')

    const [osRes, reservaRes] = await Promise.all([
      supabase
        .from('ordens_servico')
        .select('*')
        .eq('reserva_id', reservaId)
        .maybeSingle(),
      supabase
        .from('reservas')
        .select('data_retirada,horario_retirada,data_evento,clientes(nome)')
        .eq('id', reservaId)
        .maybeSingle()
    ])

    if (osRes.error) return setErro(osRes.error.message)
    if (reservaRes.error) return setErro(reservaRes.error.message)

    const osData = osRes.data as OrdemServico | null
    const reservaData = reservaRes.data as unknown as ReservaOperacional | null
    const clientePadrao = nomeClienteDaReserva(reservaData)
    const dataPadrao = reservaData?.data_retirada || reservaData?.data_evento || ''
    const horarioPadrao = reservaData?.horario_retirada || ''

    setOs(osData)
    setClienteNome(osData?.cliente_nome || clientePadrao)
    setResponsavel(osData?.responsavel || '')
    setDataRetirada(osData?.data_retirada || osData?.data_prevista || dataPadrao)
    setHorarioRetirada(osData?.horario_retirada || horarioPadrao)
    setObservacoes(osData?.observacoes || '')

    if (osData) {
      const { data: itensData, error: itensError } = await supabase
        .from('ordem_servico_itens')
        .select('*')
        .eq('ordem_servico_id', osData.id)
        .order('created_at', { ascending: true })

      if (itensError) return setErro(itensError.message)
      setItens(itensData || [])
    } else {
      setItens([])
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

  const statusCalculado =
    progresso === 100
      ? 'Concluída'
      : progresso > 0
        ? 'Em andamento'
        : 'Aberta'

  async function timeline(titulo: string, descricao: string) {
    await supabase.from('reserva_timeline').insert({
      reserva_id: reservaId,
      titulo,
      descricao,
      tipo: 'Ordem de Serviço'
    })
  }

  function validarRetirada() {
    if (!clienteNome.trim()) {
      setErro('Informe o nome do cliente ou responsável pela retirada.')
      return false
    }
    if (!dataRetirada) {
      setErro('Informe a data da retirada.')
      return false
    }
    return true
  }

  async function criarOS() {
    setErro('')
    if (!validarRetirada()) return

    const numero = `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const { data, error } = await supabase
      .from('ordens_servico')
      .insert({
        reserva_id: reservaId,
        numero,
        status: 'Aberta',
        responsavel: responsavel.trim() || null,
        cliente_nome: clienteNome.trim(),
        data_retirada: dataRetirada,
        horario_retirada: horarioRetirada || null,
        data_prevista: dataRetirada,
        observacoes: observacoes.trim() || null
      })
      .select('*')
      .single()

    if (error) return setErro(error.message)

    const tarefasPadrao = [
      { etapa: 'Separação', descricao: 'Separar todos os itens da reserva' },
      { etapa: 'Separação', descricao: 'Conferir KIT pronto ou composição do KIT personalizado' },
      { etapa: 'Separação', descricao: 'Registrar checklist antes da saída' },
      { etapa: 'Retirada', descricao: 'Confirmar entrega dos itens ao cliente ou responsável pela retirada' },
      { etapa: 'Entrega', descricao: 'Carregar itens para transporte quando houver entrega' },
      { etapa: 'Entrega', descricao: 'Confirmar entrega ao cliente quando houver entrega' },
      { etapa: 'Devolução', descricao: 'Conferir itens devolvidos' },
      { etapa: 'Devolução', descricao: 'Registrar avarias ou pendências' },
      { etapa: 'Encerramento', descricao: 'Finalizar ordem de serviço' }
    ]

    const { error: tarefasError } = await supabase.from('ordem_servico_itens').insert(
      tarefasPadrao.map(t => ({
        ordem_servico_id: data.id,
        etapa: t.etapa,
        descricao: t.descricao,
        concluido: false
      }))
    )

    if (tarefasError) return setErro(tarefasError.message)

    await timeline(
      'Ordem de Serviço criada',
      `${numero} criada para ${clienteNome.trim()}, retirada em ${dataRetirada}${horarioRetirada ? ` às ${horarioRetirada}` : ''}.`
    )
    carregar()
  }

  async function salvarOS() {
    if (!os) return
    setErro('')
    if (!validarRetirada()) return

    const { error } = await supabase
      .from('ordens_servico')
      .update({
        responsavel: responsavel.trim() || null,
        cliente_nome: clienteNome.trim(),
        data_retirada: dataRetirada,
        horario_retirada: horarioRetirada || null,
        // Espelho mantido para compatibilidade com relatórios antigos.
        data_prevista: dataRetirada,
        observacoes: observacoes.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', os.id)

    if (error) return setErro(error.message)

    await timeline(
      'Ordem de Serviço atualizada',
      `Retirada definida para ${dataRetirada}${horarioRetirada ? ` às ${horarioRetirada}` : ''} — ${clienteNome.trim()}.`
    )
    carregar()
  }

  async function alternarTarefa(item: ItemOS) {
    if (!os) return

    const novo = !item.concluido

    const { error } = await supabase
      .from('ordem_servico_itens')
      .update({
        concluido: novo,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id)

    if (error) return setErro(error.message)

    const itensAtualizados = itens.map(i =>
      i.id === item.id ? { ...i, concluido: novo } : i
    )

    const concluidos = itensAtualizados.filter(i => i.concluido).length
    const novoProgresso = itensAtualizados.length
      ? Math.round((concluidos / itensAtualizados.length) * 100)
      : 0

    const novoStatus =
      novoProgresso === 100
        ? 'Concluída'
        : novoProgresso > 0
          ? 'Em andamento'
          : 'Aberta'

    await supabase
      .from('ordens_servico')
      .update({
        status: novoStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', os.id)

    await timeline(
      novo ? 'Tarefa concluída' : 'Tarefa reaberta',
      `${item.etapa}: ${item.descricao}`
    )

    carregar()
  }

  async function adicionarTarefa(e: React.FormEvent) {
    e.preventDefault()
    if (!os) return
    if (!novaTarefa.trim()) return setErro('Informe uma tarefa extra para esta reserva.')

    const { error } = await supabase.from('ordem_servico_itens').insert({
      ordem_servico_id: os.id,
      etapa: novaEtapa,
      descricao: novaTarefa.trim(),
      concluido: false
    })

    if (error) return setErro(error.message)

    await timeline('Tarefa adicionada à OS', `${novaEtapa}: ${novaTarefa.trim()}`)
    setNovaTarefa('')
    carregar()
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Centro Operacional</h2>
      <p className="mt-1 text-sm text-slate-500">
        Controle a retirada, entrega, devolução e execução da reserva pela Ordem de Serviço.
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Cliente / responsável pela retirada *" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
            <Input label="Responsável interno" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
            <Input label="Data da retirada *" type="date" value={dataRetirada} onChange={e => setDataRetirada(e.target.value)} />
            <Input label="Horário da retirada" type="time" value={horarioRetirada} onChange={e => setHorarioRetirada(e.target.value)} />
          </div>

          <div className="mt-4">
            <Button onClick={criarOS}>Criar Ordem de Serviço</Button>
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
              <p className="text-xl font-bold text-slate-900">{statusCalculado}</p>
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

          <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-4">
            <h3 className="font-semibold text-slate-900">Retirada / atendimento</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Input label="Cliente / responsável pela retirada *" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
              <Input label="Responsável interno" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
              <Input label="Data da retirada *" type="date" value={dataRetirada} onChange={e => setDataRetirada(e.target.value)} />
              <Input label="Horário da retirada" type="time" value={horarioRetirada} onChange={e => setHorarioRetirada(e.target.value)} />
            </div>
          </div>

          <Textarea label="Observações" value={observacoes} onChange={e => setObservacoes(e.target.value)} />

          <Button onClick={salvarOS}>Salvar OS</Button>

          <form onSubmit={adicionarTarefa} className="rounded-2xl border bg-slate-50 p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Adicionar tarefa extra</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Select label="Etapa" value={novaEtapa} onChange={e => setNovaEtapa(e.target.value)}>
                <option>Separação</option>
                <option>Retirada</option>
                <option>Entrega</option>
                <option>Devolução</option>
                <option>Encerramento</option>
              </Select>

              <Input label="Tarefa extra" value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} />

              <div className="flex items-end">
                <Button type="submit">Adicionar</Button>
              </div>
            </div>
          </form>

          <ReservaEquipeOS
            reservaId={reservaId}
            ordemServicoId={os.id}
          />

          <div className="grid gap-4 md:grid-cols-2">
            {['Separação', 'Retirada', 'Entrega', 'Devolução', 'Encerramento'].map(etapa => (
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
