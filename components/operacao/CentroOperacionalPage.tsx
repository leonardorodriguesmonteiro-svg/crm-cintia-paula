'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type OrdemServico = {
  id: string
  reserva_id: string
  numero: string
  status: string | null
  responsavel: string | null
  data_prevista: string | null
  observacoes: string | null
  reservas: {
    id: string
    data_evento: string
    horario_evento: string | null
    clientes: { nome: string } | null
    kits: { nome: string } | null
  } | null
}

const colunas = [
  {
    titulo: 'A fazer',
    status: 'Aberta',
    descricao: 'Ordens ainda não iniciadas.'
  },
  {
    titulo: 'Em andamento',
    status: 'Em andamento',
    descricao: 'Operações que já começaram.'
  },
  {
    titulo: 'Concluídas',
    status: 'Concluída',
    descricao: 'Ordens finalizadas.'
  }
]

export function CentroOperacionalPage() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
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
        observacoes,
        reservas (
          id,
          data_evento,
          horario_evento,
          clientes (nome),
          kits (nome)
        )
      `)
      .order('data_prevista', { ascending: true })

    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    setOrdens((data as any) || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const hoje = new Date().toISOString().slice(0, 10)

  const resumo = useMemo(() => {
    return {
      abertas: ordens.filter(item => item.status === 'Aberta').length,
      andamento: ordens.filter(item => item.status === 'Em andamento').length,
      concluidas: ordens.filter(item => item.status === 'Concluída').length,
      atrasadas: ordens.filter(
        item =>
          item.status !== 'Concluída' &&
          item.data_prevista &&
          item.data_prevista < hoje
      ).length
    }
  }, [ordens, hoje])

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Centro Operacional
          </h1>
          <p className="text-slate-500">
            Acompanhe todas as Ordens de Serviço e prioridades da operação.
          </p>
        </div>

        <Button variant="secondary" onClick={carregar}>
          Atualizar
        </Button>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">A fazer</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {resumo.abertas}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Em andamento</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">
            {resumo.andamento}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Concluídas</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {resumo.concluidas}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Atrasadas</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {resumo.atrasadas}
          </p>
        </Card>
      </div>

      {carregando ? (
        <Card>
          <p className="text-sm text-slate-500">
            Carregando Ordens de Serviço...
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-3">
          {colunas.map(coluna => {
            const itens = ordens.filter(
              item => (item.status || 'Aberta') === coluna.status
            )

            return (
              <div
                key={coluna.status}
                className="rounded-3xl border bg-slate-50 p-4"
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-slate-900">
                      {coluna.titulo}
                    </h2>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                      {itens.length}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {coluna.descricao}
                  </p>
                </div>

                <div className="space-y-3">
                  {itens.map(ordem => {
                    const atrasada =
                      ordem.status !== 'Concluída' &&
                      ordem.data_prevista &&
                      ordem.data_prevista < hoje

                    return (
                      <Link
                        key={ordem.id}
                        href={`/reservas/${ordem.reserva_id}`}
                        className={`block rounded-2xl border bg-white p-4 transition hover:border-pink-300 hover:shadow-sm ${
                          atrasada ? 'border-red-300' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-bold text-slate-900">
                              {ordem.numero}
                            </p>

                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {ordem.reservas?.clientes?.nome ||
                                'Cliente não informado'}
                            </p>
                          </div>

                          {atrasada && (
                            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">
                              Atrasada
                            </span>
                          )}
                        </div>

                        <div className="mt-3 space-y-1 text-sm text-slate-500">
                          <p>
                            <strong>Kit:</strong>{' '}
                            {ordem.reservas?.kits?.nome || '-'}
                          </p>

                          <p>
                            <strong>Evento:</strong>{' '}
                            {ordem.reservas?.data_evento || '-'}
                            {ordem.reservas?.horario_evento
                              ? ` às ${ordem.reservas.horario_evento}`
                              : ''}
                          </p>

                          <p>
                            <strong>Responsável:</strong>{' '}
                            {ordem.responsavel || 'Não definido'}
                          </p>

                          <p>
                            <strong>Data prevista:</strong>{' '}
                            {ordem.data_prevista || '-'}
                          </p>
                        </div>

                        <p className="mt-3 text-sm font-semibold text-pink-700">
                          Abrir operação →
                        </p>
                      </Link>
                    )
                  })}

                  {itens.length === 0 && (
                    <div className="rounded-2xl border border-dashed bg-white p-6 text-center text-sm text-slate-400">
                      Nenhuma Ordem de Serviço nesta etapa.
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
