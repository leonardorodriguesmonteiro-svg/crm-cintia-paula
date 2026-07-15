'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'

type Colaborador = {
  id: string
  nome: string
  funcao: string | null
}

type Vinculo = {
  id: string
  colaborador_id: string
  funcao_na_os: string | null
  horario_inicio: string | null
  horario_fim: string | null
  equipe: {
    nome: string
    funcao: string | null
  } | null
}

export function ReservaEquipeOS({
  reservaId,
  ordemServicoId
}: {
  reservaId: string
  ordemServicoId: string
}) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [colaboradorId, setColaboradorId] = useState('')
  const [funcao, setFuncao] = useState('Montagem')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    const equipeRes = await supabase
      .from('equipe')
      .select('id,nome,funcao')
      .eq('ativo', true)
      .order('nome')

    const vinculosRes = await supabase
      .from('ordem_servico_equipe')
      .select(`
        id,
        colaborador_id,
        funcao_na_os,
        horario_inicio,
        horario_fim,
        equipe (
          nome,
          funcao
        )
      `)
      .eq('ordem_servico_id', ordemServicoId)

    if (equipeRes.error) setErro(equipeRes.error.message)
    else setColaboradores(equipeRes.data || [])

    if (vinculosRes.error) setErro(vinculosRes.error.message)
    else setVinculos((vinculosRes.data as any) || [])
  }

  useEffect(() => {
    carregar()
  }, [ordemServicoId])

  async function registrarTimeline(titulo: string, descricao: string) {
    await supabase.from('reserva_timeline').insert({
      reserva_id: reservaId,
      titulo,
      descricao,
      tipo: 'Equipe'
    })
  }

  async function adicionar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')

    if (!colaboradorId) {
      setErro('Selecione um colaborador.')
      return
    }

    const colaborador = colaboradores.find(
      item => item.id === colaboradorId
    )

    const { error } = await supabase
      .from('ordem_servico_equipe')
      .insert({
        ordem_servico_id: ordemServicoId,
        colaborador_id: colaboradorId,
        funcao_na_os: funcao,
        horario_inicio: inicio || null,
        horario_fim: fim || null
      })

    if (error) {
      setErro(
        error.code === '23505'
          ? 'Este colaborador já está vinculado à Ordem de Serviço.'
          : error.message
      )
      return
    }

    await registrarTimeline(
      'Colaborador vinculado à OS',
      `${colaborador?.nome || 'Colaborador'} foi alocado como ${funcao}.`
    )

    setColaboradorId('')
    setInicio('')
    setFim('')
    carregar()
  }

  async function remover(vinculo: Vinculo) {
    if (!confirm('Remover este colaborador da Ordem de Serviço?')) return

    const { error } = await supabase
      .from('ordem_servico_equipe')
      .delete()
      .eq('id', vinculo.id)

    if (error) {
      setErro(error.message)
      return
    }

    await registrarTimeline(
      'Colaborador removido da OS',
      `${vinculo.equipe?.nome || 'Colaborador'} foi removido da equipe.`
    )

    carregar()
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">
        Equipe da Ordem de Serviço
      </h2>

      <p className="mt-1 text-sm text-slate-500">
        Defina quem participará da execução do evento.
      </p>

      {erro && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <form
        onSubmit={adicionar}
        className="mt-5 rounded-2xl border bg-slate-50 p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Select
            label="Colaborador"
            value={colaboradorId}
            onChange={evento => setColaboradorId(evento.target.value)}
          >
            <option value="">Selecione...</option>

            {colaboradores.map(item => (
              <option key={item.id} value={item.id}>
                {item.nome} — {item.funcao || 'Sem função'}
              </option>
            ))}
          </Select>

          <Select
            label="Função na OS"
            value={funcao}
            onChange={evento => setFuncao(evento.target.value)}
          >
            <option>Montagem</option>
            <option>Decoração</option>
            <option>Entrega</option>
            <option>Motorista</option>
            <option>Separação</option>
            <option>Conferência</option>
            <option>Retirada</option>
            <option>Outro</option>
          </Select>

          <Input
            label="Início"
            type="time"
            value={inicio}
            onChange={evento => setInicio(evento.target.value)}
          />

          <Input
            label="Fim"
            type="time"
            value={fim}
            onChange={evento => setFim(evento.target.value)}
          />
        </div>

        <div className="mt-4">
          <Button type="submit">Adicionar à equipe</Button>
        </div>
      </form>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {vinculos.map(vinculo => (
          <div key={vinculo.id} className="rounded-2xl border p-4">
            <p className="font-bold text-slate-900">
              {vinculo.equipe?.nome || 'Colaborador'}
            </p>

            <p className="text-sm text-slate-500">
              {vinculo.funcao_na_os || vinculo.equipe?.funcao || '-'}
            </p>

            <p className="mt-2 text-sm text-slate-600">
              Horário: {vinculo.horario_inicio || '-'} até{' '}
              {vinculo.horario_fim || '-'}
            </p>

            <div className="mt-4">
              <Button
                type="button"
                variant="danger"
                onClick={() => remover(vinculo)}
              >
                Remover
              </Button>
            </div>
          </div>
        ))}

        {vinculos.length === 0 && (
          <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
            Nenhum colaborador vinculado à OS.
          </div>
        )}
      </div>
    </Card>
  )
}
