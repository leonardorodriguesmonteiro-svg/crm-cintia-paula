'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

type Missao = {
  id: string
  reserva_id: string
  numero: string
  status: string | null
  responsavel: string | null
  data_prevista: string | null
  reservas: {
    data_evento: string
    horario_evento: string | null
    endereco_evento: string | null
    clientes: { nome: string } | null
    kits: { nome: string } | null
  } | null
  ordem_servico_itens: {
    id: string
    concluido: boolean
  }[]
  ordem_servico_equipe: {
    id: string
    funcao_na_os: string | null
    equipe: { nome: string } | null
  }[]
}

export function MissoesPage() {
  const [missoes, setMissoes] = useState<Missao[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setErro('')
    setCarregando(true)

    const { data, error } = await supabase
      .from('ordens_servico')
      .select(`
        id,
        reserva_id,
        numero,
        status,
        responsavel,
        data_prevista,
        reservas (
          data_evento,
          horario_evento,
          endereco_evento,
          clientes (nome),
          kits (nome)
        ),
        ordem_servico_itens (
          id,
          concluido
        ),
        ordem_servico_equipe (
          id,
          funcao_na_os,
          equipe (nome)
        )
      `)
      .order('data_prevista', { ascending: true })

    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    setMissoes((data as any) || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const hoje = new Date().toISOString().slice(0, 10)

  const missoesHoje = useMemo(() => {
    return missoes.filter(item => {
      const data = item.data_prevista || item.reservas?.data_evento
      return data === hoje
    })
  }, [missoes, hoje])

  function calcularProgresso(missao: Missao) {
    const tarefas = missao.ordem_servico_itens || []

    if (tarefas.length === 0) return 0

    const concluidas = tarefas.filter(item => item.concluido).length
    return Math.round((concluidas / tarefas.length) * 100)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-28 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-pink-700">
              ERP FIELD
            </p>

            <h1 className="text-3xl font-bold text-slate-900">
              Missões de hoje
            </h1>

            <p className="text-slate-500">
              {missoesHoje.length} missão(ões) programada(s)
            </p>
          </div>

          <Button variant="secondary" onClick={carregar}>
            Atualizar
          </Button>
        </div>

        {erro && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        {carregando && (
          <div className="rounded-3xl border bg-white p-6 text-slate-500">
            Carregando missões...
          </div>
        )}

        {!carregando && missoesHoje.length === 0 && (
          <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
            <p className="font-semibold text-slate-900">
              Nenhuma missão para hoje
            </p>

            <p className="mt-1 text-sm text-slate-500">
              As Ordens de Serviço do dia aparecerão aqui.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {missoesHoje.map(missao => {
            const progresso = calcularProgresso(missao)

            return (
              <div
                key={missao.id}
                className="rounded-3xl border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-pink-700">
                      {missao.numero}
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {missao.reservas?.clientes?.nome || 'Cliente não informado'}
                    </h2>

                    <p className="text-sm text-slate-500">
                      {missao.reservas?.kits?.nome || 'Kit não informado'}
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    {missao.status || 'Aberta'}
                  </span>
                </div>

                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <p>
                    <strong>Horário:</strong>{' '}
                    {missao.reservas?.horario_evento || '-'}
                  </p>

                  <p>
                    <strong>Endereço:</strong>{' '}
                    {missao.reservas?.endereco_evento || '-'}
                  </p>

                  <p>
                    <strong>Equipe:</strong>{' '}
                    {missao.ordem_servico_equipe?.length
                      ? missao.ordem_servico_equipe
                          .map(item => item.equipe?.nome)
                          .filter(Boolean)
                          .join(', ')
                      : 'Não definida'}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      Progresso
                    </span>

                    <span className="font-bold text-pink-700">
                      {progresso}%
                    </span>
                  </div>

                  <div className="mt-2 h-3 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-pink-600"
                      style={{ width: `${progresso}%` }}
                    />
                  </div>
                </div>

                <Link
                  href={`/missoes/${missao.id}`}
                  className="mt-5 flex w-full justify-center rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white hover:bg-pink-700"
                >
                  Executar missão
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
