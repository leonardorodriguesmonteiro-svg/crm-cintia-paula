'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { MissionViewModel } from '@/lib/application/mission/mission.types'
import { Button } from '@/components/ui/Button'

export function MissionWorkspace({
  missaoId
}: {
  missaoId: string
}) {
  const [missao, setMissao] = useState<MissionViewModel | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const resposta = await fetch(`/api/missoes/${missaoId}`, {
        cache: 'no-store'
      })

      const resultado = await resposta.json()

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.erro || 'Não foi possível carregar a missão.')
      }

      setMissao(resultado.missao)
    } catch (error: any) {
      setErro(error?.message || 'Erro ao carregar a missão.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [missaoId])

  const etapas = useMemo(() => {
    if (!missao) return []

    return Array.from(
      new Set(missao.checklist.map(item => item.etapa))
    )
  }, [missao])

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border bg-white p-8 text-slate-500">
          Carregando missão...
        </div>
      </div>
    )
  }

  if (erro || !missao) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">Não foi possível abrir a missão.</p>
          <p className="mt-1 text-sm">{erro}</p>

          <div className="mt-4">
            <Button onClick={carregar}>Tentar novamente</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-28 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-3xl border bg-white p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-pink-700">
                MISSÃO {missao.numero}
              </p>

              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {missao.evento.cliente}
              </h1>

              <p className="text-slate-500">
                {missao.evento.kit}
              </p>
            </div>

            <span className="w-fit rounded-full bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700">
              {missao.status}
            </span>
          </div>

          <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-500">Data</p>
              <p className="font-semibold text-slate-900">
                {missao.evento.data || '-'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-500">Horário</p>
              <p className="font-semibold text-slate-900">
                {missao.evento.horario || '-'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-slate-500">Etapa atual</p>
              <p className="font-semibold text-slate-900">
                {missao.etapaAtual}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            <strong>Endereço:</strong> {missao.evento.endereco || '-'}
          </p>
        </div>

        <div className="rounded-3xl border border-pink-200 bg-pink-50 p-5 md:p-6">
          <p className="text-sm font-semibold text-pink-700">
            PRÓXIMA AÇÃO
          </p>

          <h2 className="mt-2 text-xl font-bold text-slate-900">
            {missao.proximaAcao.titulo}
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Etapa: {missao.proximaAcao.etapa}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Progresso da missão</p>
              <p className="text-2xl font-bold text-slate-900">
                {missao.progresso}%
              </p>
            </div>

            <Button variant="secondary" onClick={carregar}>
              Atualizar
            </Button>
          </div>

          <div className="mt-4 h-4 rounded-full bg-slate-100">
            <div
              className="h-4 rounded-full bg-pink-600 transition-all"
              style={{ width: `${missao.progresso}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Checklist operacional
          </h2>

          <div className="mt-5 space-y-5">
            {etapas.map(etapa => {
              const tarefas = missao.checklist.filter(
                item => item.etapa === etapa
              )

              const concluidas = tarefas.filter(
                item => item.concluido
              ).length

              return (
                <div key={etapa} className="rounded-2xl border p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">{etapa}</p>
                    <span className="text-sm font-semibold text-slate-500">
                      {concluidas}/{tarefas.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {tarefas.map(tarefa => (
                      <div
                        key={tarefa.id}
                        className={`rounded-xl border px-4 py-3 text-sm ${
                          tarefa.concluido
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {tarefa.concluido ? '✓' : '○'} {tarefa.descricao}

                        {tarefa.obrigatoria && !tarefa.concluido && (
                          <span className="ml-2 text-xs font-semibold text-red-600">
                            Obrigatória
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Equipe da missão
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {missao.equipe.map(pessoa => (
              <div key={pessoa.id} className="rounded-2xl border p-4">
                <p className="font-bold text-slate-900">{pessoa.nome}</p>
                <p className="text-sm text-slate-500">{pessoa.funcao}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {pessoa.inicio || '-'} até {pessoa.fim || '-'}
                </p>
              </div>
            ))}

            {missao.equipe.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum colaborador alocado.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5 md:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Timeline da missão
          </h2>

          <div className="mt-4 space-y-3">
            {missao.timeline.map(item => (
              <div key={item.id} className="border-l-4 border-pink-200 pl-4">
                <p className="font-semibold text-slate-900">
                  {item.titulo}
                </p>

                <p className="text-sm text-slate-500">
                  {item.modulo} •{' '}
                  {new Date(item.data).toLocaleString('pt-BR')}
                </p>

                {item.descricao && (
                  <p className="mt-1 text-sm text-slate-600">
                    {item.descricao}
                  </p>
                )}
              </div>
            ))}

            {missao.timeline.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum evento registrado na Timeline Universal.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/reservas/${missao.reservaId}`}
            className="rounded-xl border bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700"
          >
            Abrir reserva completa
          </Link>

          <Link
            href="/missoes"
            className="rounded-xl bg-pink-600 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Voltar para missões
          </Link>
        </div>
      </div>
    </div>
  )
}
