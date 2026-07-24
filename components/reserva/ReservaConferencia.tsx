'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type TipoConferencia = 'Retirada' | 'Devolução'

type ItemConferencia = {
  itemId: string
  codigo: string
  nome: string
  quantidadePrevista: number
  quantidadeConferida: number
  quantidadeDanificada: number
  observacoes: string
}

type Historico = {
  id: string
  tipo: TipoConferencia
  responsavel: string | null
  observacoes: string | null
  status: string
  conferido_em: string
  conferencia_itens: Array<{
    id: string
    item_id: string
    quantidade_prevista: number
    quantidade_conferida: number
    quantidade_danificada: number
    quantidade_faltante: number
    observacoes: string | null
    estoque_itens: {
      codigo: string | null
      nome: string
    } | null
  }>
}

export function ReservaConferencia({
  reservaId,
  onAtualizar
}: {
  reservaId: string
  onAtualizar?: () => void | Promise<void>
}) {
  const [tipo, setTipo] = useState<TipoConferencia>('Retirada')
  const [statusReserva, setStatusReserva] = useState('')
  const [kitId, setKitId] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemConferencia[]>([])
  const [historico, setHistorico] = useState<Historico[]>([])
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar(tipoDesejado: TipoConferencia = tipo) {
    setErro('')

    const reservaRes = await supabase
      .from('reservas')
      .select('id,kit_id,status')
      .eq('id', reservaId)
      .single()

    if (reservaRes.error) {
      setErro(reservaRes.error.message)
      return
    }

    const kit = reservaRes.data.kit_id || ''
    setKitId(kit)
    setStatusReserva(reservaRes.data.status || '')

    const [composicaoRes, historicoRes] = await Promise.all([
      supabase
        .from('kit_composicao')
        .select('item_id,quantidade,estoque_itens(id,codigo,nome)')
        .eq('kit_id', kit)
        .order('created_at', { ascending: true }),
      supabase
        .from('conferencias')
        .select('id,tipo,responsavel,observacoes,status,conferido_em,conferencia_itens(id,item_id,quantidade_prevista,quantidade_conferida,quantidade_danificada,quantidade_faltante,observacoes,estoque_itens!conferencia_itens_item_id_fkey(codigo,nome))')
        .eq('reserva_id', reservaId)
        .order('conferido_em', { ascending: false })
    ])

    if (composicaoRes.error) {
      setErro(composicaoRes.error.message)
      return
    }
    if (historicoRes.error) {
      setErro(historicoRes.error.message)
      return
    }

    const listaHistorico = (historicoRes.data as any as Historico[]) || []
    setHistorico(listaHistorico)

    const existente = listaHistorico.find(item => item.tipo === tipoDesejado)
    if (existente) {
      setResponsavel(existente.responsavel || '')
      setObservacoes(existente.observacoes || '')
      setItens(existente.conferencia_itens.map(item => ({
        itemId: item.item_id,
        codigo: item.estoque_itens?.codigo || '',
        nome: item.estoque_itens?.nome || 'Item',
        quantidadePrevista: Number(item.quantidade_prevista || 0),
        quantidadeConferida: Number(item.quantidade_conferida || 0),
        quantidadeDanificada: Number(item.quantidade_danificada || 0),
        observacoes: item.observacoes || ''
      })))
      return
    }

    setResponsavel('')
    setObservacoes('')
    setItens(((composicaoRes.data as any[]) || []).map(item => ({
      itemId: item.item_id,
      codigo: item.estoque_itens?.codigo || '',
      nome: item.estoque_itens?.nome || 'Item',
      quantidadePrevista: Number(item.quantidade || 0),
      quantidadeConferida: Number(item.quantidade || 0),
      quantidadeDanificada: 0,
      observacoes: ''
    })))
  }

  useEffect(() => {
    carregar('Retirada')
  }, [reservaId])

  function trocarTipo(novoTipo: TipoConferencia) {
    setTipo(novoTipo)
    setSucesso('')
    carregar(novoTipo)
  }

  function atualizarQuantidade(
    indice: number,
    campo: 'quantidadeConferida' | 'quantidadeDanificada',
    valor: number
  ) {
    setItens(atuais => atuais.map((item, posicao) => {
      if (posicao !== indice) return item

      if (campo === 'quantidadeConferida') {
        const quantidadeConferida = Math.min(
          Math.max(valor, 0),
          item.quantidadePrevista
        )
        return {
          ...item,
          quantidadeConferida,
          quantidadeDanificada: Math.min(item.quantidadeDanificada, quantidadeConferida)
        }
      }

      return {
        ...item,
        quantidadeDanificada: Math.min(
          Math.max(valor, 0),
          item.quantidadeConferida
        )
      }
    }))
  }

  function atualizarObservacao(indice: number, valor: string) {
    setItens(atuais => atuais.map((item, posicao) =>
      posicao === indice ? {...item, observacoes: valor} : item
    ))
  }

  function marcarTodos() {
    setItens(atuais => atuais.map(item => ({
      ...item,
      quantidadeConferida: item.quantidadePrevista,
      quantidadeDanificada: 0
    })))
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    setErro('')
    setSucesso('')
    setSalvando(true)

    const { error } = await supabase.rpc('registrar_conferencia', {
      p_reserva_id: reservaId,
      p_tipo: tipo,
      p_responsavel: responsavel,
      p_observacoes: observacoes,
      p_itens: itens.map(item => ({
        item_id: item.itemId,
        quantidade_conferida: item.quantidadeConferida,
        quantidade_danificada: item.quantidadeDanificada,
        observacoes: item.observacoes
      }))
    })

    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }

    setSucesso(`${tipo} registrada com sucesso. O estoque e a reserva foram atualizados.`)
    setSalvando(false)
    await carregar(tipo)
    await onAtualizar?.()
  }

  const retirada = historico.find(item => item.tipo === 'Retirada')
  const devolucao = historico.find(item => item.tipo === 'Devolução')
  const tipoPermitido = tipo === 'Retirada'
    ? !devolucao && (Boolean(retirada) || statusReserva === 'Confirmada')
    : Boolean(devolucao) || (Boolean(retirada) && statusReserva === 'Em andamento')

  const resumo = useMemo(() => itens.reduce((total, item) => ({
    faltantes: total.faltantes + Math.max(item.quantidadePrevista - item.quantidadeConferida, 0),
    danificados: total.danificados + item.quantidadeDanificada
  }), {faltantes: 0, danificados: 0}), [itens])

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Conferência operacional</h2>
            <p className="mt-1 text-sm text-slate-500">
              Confirme a saída e a devolução da composição real do kit.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Reserva: {statusReserva || '—'}
          </span>
        </div>

        {erro && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
        {sucesso && <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

        <form onSubmit={salvar} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Etapa" value={tipo} onChange={event => trocarTipo(event.target.value as TipoConferencia)}>
              <option>Retirada</option>
              <option>Devolução</option>
            </Select>
            <Input
              required
              label="Responsável"
              value={responsavel}
              onChange={event => setResponsavel(event.target.value)}
            />
          </div>

          {!kitId && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Esta reserva não possui kit vinculado.
            </div>
          )}

          {kitId && itens.length === 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              O kit ainda não possui composição. Configure-a antes da conferência.
            </div>
          )}

          {!tipoPermitido && itens.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {tipo === 'Retirada'
                ? 'A reserva precisa estar confirmada e ainda não pode ter devolução.'
                : 'Registre a retirada antes da devolução.'}
            </div>
          )}

          {itens.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <p className="font-semibold text-slate-900">{itens.length} item(ns) na composição</p>
                  <p className="text-sm text-slate-500">
                    {resumo.danificados} danificado(s) · {resumo.faltantes} faltante(s)
                  </p>
                </div>
                <Button variant="secondary" onClick={marcarTodos}>Marcar todos conformes</Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500">
                      <th className="p-3">Item</th>
                      <th>Previsto</th>
                      <th>Conferido</th>
                      <th>Danificado</th>
                      <th>Faltante</th>
                      <th>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, indice) => (
                      <tr key={item.itemId} className="border-t">
                        <td className="p-3 font-medium">{item.codigo || '—'} — {item.nome}</td>
                        <td>{item.quantidadePrevista}</td>
                        <td>
                          <input
                            aria-label={`Quantidade conferida de ${item.codigo || item.nome}`}
                            className="w-20 rounded-lg border px-2 py-1"
                            type="number"
                            min="0"
                            max={item.quantidadePrevista}
                            value={item.quantidadeConferida}
                            onChange={event => atualizarQuantidade(indice, 'quantidadeConferida', Number(event.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Quantidade danificada de ${item.codigo || item.nome}`}
                            className="w-20 rounded-lg border px-2 py-1"
                            type="number"
                            min="0"
                            max={item.quantidadeConferida}
                            value={item.quantidadeDanificada}
                            onChange={event => atualizarQuantidade(indice, 'quantidadeDanificada', Number(event.target.value))}
                          />
                        </td>
                        <td>{Math.max(item.quantidadePrevista - item.quantidadeConferida, 0)}</td>
                        <td>
                          <input
                            aria-label={`Observações de ${item.codigo || item.nome}`}
                            className="min-w-52 rounded-lg border px-2 py-1"
                            value={item.observacoes}
                            onChange={event => atualizarObservacao(indice, event.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Textarea
            label="Observações gerais"
            value={observacoes}
            onChange={event => setObservacoes(event.target.value)}
          />

          <Button
            type="submit"
            disabled={salvando || !itens.length || !tipoPermitido || !responsavel.trim()}
          >
            {salvando ? 'Registrando...' : `Registrar ${tipo.toLowerCase()}`}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Histórico de conferências</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {historico.map(item => (
            <div key={item.id} className="rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-pink-700">{item.tipo}</p>
                  <p className="mt-1 font-semibold">{item.responsavel || 'Sem responsável'}</p>
                  <p className="text-sm text-slate-500">{new Date(item.conferido_em).toLocaleString('pt-BR')}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  item.status === 'Conforme'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-amber-50 text-amber-800'
                }`}>
                  {item.status}
                </span>
              </div>
              {item.conferencia_itens.some(linha => linha.quantidade_danificada || linha.quantidade_faltante) && (
                <div className="mt-3 space-y-1 border-t pt-3 text-sm text-slate-600">
                  {item.conferencia_itens
                    .filter(linha => linha.quantidade_danificada || linha.quantidade_faltante)
                    .map(linha => (
                      <p key={linha.id}>
                        {linha.estoque_itens?.nome || 'Item'}: {linha.quantidade_danificada} danificado(s), {linha.quantidade_faltante} faltante(s)
                      </p>
                    ))}
                </div>
              )}
            </div>
          ))}
          {historico.length === 0 && <p className="text-sm text-slate-500">Nenhuma conferência registrada.</p>}
        </div>
      </Card>
    </div>
  )
}
