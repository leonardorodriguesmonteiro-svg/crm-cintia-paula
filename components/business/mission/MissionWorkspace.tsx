'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { MissionViewModel } from '@/lib/application/mission/mission.types'
import { Button } from '@/components/ui/Button'
import { MissionHeader } from './MissionHeader'
import { MissionActionCard } from './MissionActionCard'
import { MissionProgress } from './MissionProgress'
import { MissionChecklist } from './MissionChecklist'
import { MissionTeam } from './MissionTeam'
import { MissionTimeline } from './MissionTimeline'

export function MissionWorkspace({
  missaoId
}: {
  missaoId: string
}) {
  const [missao, setMissao] =
    useState<MissionViewModel | null>(null)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [atualizandoTarefa, setAtualizandoTarefa] =
    useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const resposta = await fetch(
        `/api/missoes/${missaoId}`,
        { cache: 'no-store' }
      )

      const resultado = await resposta.json()

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(
          resultado.erro ||
            'Não foi possível carregar a missão.'
        )
      }

      setMissao(resultado.missao)
    } catch (error: any) {
      setErro(
        error?.message || 'Erro ao carregar a missão.'
      )
    } finally {
      setCarregando(false)
    }
  }

  async function alternarTarefa(
    tarefaId: string,
    concluidoAtual: boolean
  ) {
    setAtualizandoTarefa(tarefaId)
    setErro('')

    try {
      const resposta = await fetch(
        `/api/missoes/${missaoId}/tarefas/${tarefaId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            concluido: !concluidoAtual
          })
        }
      )

      const resultado = await resposta.json()

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(
          resultado.erro ||
            'Não foi possível atualizar a tarefa.'
        )
      }

      await carregar()
    } catch (error: any) {
      setErro(
        error?.message || 'Erro ao atualizar a tarefa.'
      )
    } finally {
      setAtualizandoTarefa(null)
    }
  }

  useEffect(() => {
    carregar()
  }, [missaoId])

  if (carregando && !missao) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border bg-white p-8 text-slate-500">
          Carregando missão...
        </div>
      </div>
    )
  }

  if (!missao) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="font-semibold">
            Não foi possível abrir a missão.
          </p>

          <p className="mt-1 text-sm">{erro}</p>

          <div className="mt-4">
            <Button onClick={carregar}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 pb-28 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        {erro && (
          <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {erro}
          </div>
        )}

        <MissionHeader missao={missao} />

        <MissionActionCard missao={missao} />

        <MissionProgress
          progresso={missao.progresso}
          onAtualizar={carregar}
        />

        <MissionChecklist
          checklist={missao.checklist}
          atualizandoTarefa={atualizandoTarefa}
          onAlternar={alternarTarefa}
        />

        <MissionTeam equipe={missao.equipe} />

        <MissionTimeline timeline={missao.timeline} />

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
