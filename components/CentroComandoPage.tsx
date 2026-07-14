'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { MissaoDoDia } from '@/components/comando/MissaoDoDia'
import { AcoesRapidas } from '@/components/comando/AcoesRapidas'
import { calcularCentroComando } from '@/lib/services/centroComandoService'
import { gerarRecomendacoes } from '@/lib/services/inteligencia/recommendationService'
import { RecomendacoesOperacionais } from '@/components/comando/RecomendacoesOperacionais'
import { SaudeOperacional } from '@/components/comando/SaudeOperacional'
import { calcularOperationalScore } from '@/lib/intelligence/operationalScore'

type Reserva = {
  id: string
  data_evento: string
  horario_evento: string | null
  status: string | null
  valor_total: number | null
  valor_sinal: number | null
  clientes: { nome: string } | null
  kits: { nome: string } | null
}

type Contrato = {
  id: string
  reserva_id: string | null
  status: string | null
}

type OrdemServico = {
  id: string
  reserva_id: string | null
  status: string | null
  data_prevista: string | null
}

type Logistica = {
  id: string
  etapa: string
  status: string | null
  horario_previsto: string | null
}

type WorkflowEvento = {
  id: string
  titulo: string
  tipo: string
  created_at: string
}

export function CentroComandoPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [logistica, setLogistica] = useState<Logistica[]>([])
  const [workflow, setWorkflow] = useState<WorkflowEvento[]>([])
  const [workflowAcoes, setWorkflowAcoes] = useState<any[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setErro('')
    setCarregando(true)

    const [reservasRes, contratosRes, ordensRes, logisticaRes, workflowRes, workflowAcoesRes] =
      await Promise.all([
        supabase
          .from('reservas')
          .select('id,data_evento,horario_evento,status,valor_total,valor_sinal,clientes(nome),kits(nome)')
          .order('data_evento', { ascending: true }),

        supabase
          .from('contratos')
          .select('id,reserva_id,status'),

        supabase
          .from('ordens_servico')
          .select('id,reserva_id,status,data_prevista'),

        supabase
          .from('reserva_logistica')
          .select('id,etapa,status,horario_previsto'),

        supabase
          .from('workflow_eventos')
          .select('id,titulo,tipo,created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        supabase
          .from('workflow_acoes')
          .select('status')
      ])

    const primeiraFalha =
      reservasRes.error ||
      contratosRes.error ||
      ordensRes.error ||
      logisticaRes.error ||
      workflowRes.error ||
      workflowAcoesRes.error

    if (primeiraFalha) {
      setErro(primeiraFalha.message)
    }

    setReservas((reservasRes.data as any) || [])
    setContratos(contratosRes.data || [])
    setOrdens(ordensRes.data || [])
    setLogistica(logisticaRes.data || [])
    setWorkflow(workflowRes.data || [])
    setWorkflowAcoes(workflowAcoesRes.data || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const hoje = new Date().toISOString().slice(0, 10)

  const dados = useMemo(() => {
    return calcularCentroComando({
      reservas,
      contratos,
      ordens,
      logistica,
      hoje
    })
  }, [reservas, contratos, ordens, logistica, hoje])

  const recomendacoes = useMemo(() => {
    return gerarRecomendacoes({
      reservas,
      contratos,
      ordens,
      hoje
    })
  }, [reservas, contratos, ordens, hoje])

  const score = useMemo(() => {
    return calcularOperationalScore({
      contratos,
      ordens,
      workflowAcoes,
      recomendacoesAltas: recomendacoes.filter(
        item => item.prioridade === 'Alta'
      ).length,
      recomendacoesMedias: recomendacoes.filter(
        item => item.prioridade === 'Média'
      ).length
    })
  }, [contratos, ordens, workflowAcoes, recomendacoes])

  const saudacao =
    new Date().getHours() < 12
      ? 'Bom dia'
      : new Date().getHours() < 18
        ? 'Boa tarde'
        : 'Boa noite'

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {saudacao}, Cíntia 👋
          </h1>
          <p className="text-slate-500">
            Aqui está o resumo da operação de hoje.
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

      <MissaoDoDia
        eventosHoje={dados.eventosHoje.length}
        entregasHoje={dados.entregasHoje}
        retiradasHoje={dados.retiradasHoje}
        contratosPendentes={dados.contratosPendentes}
        osPendentes={dados.osPendentes}
        receberHoje={dados.receberHoje}
      />

      <AcoesRapidas />

      <SaudeOperacional score={score} />

      <RecomendacoesOperacionais recomendacoes={recomendacoes} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Eventos hoje</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {dados.eventosHoje.length}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Entregas hoje</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            {dados.entregasHoje}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Retiradas hoje</p>
          <p className="mt-2 text-3xl font-bold text-purple-700">
            {dados.retiradasHoje}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">A receber hoje</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            R$ {dados.receberHoje.toFixed(2)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Pendências
              </h2>
              <p className="text-sm text-slate-500">
                Itens que precisam de atenção.
              </p>
            </div>

            <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-bold text-red-700">
              {dados.totalPendencias}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            <Link href="/contratos" className="block rounded-xl border p-4 hover:bg-slate-50">
              <p className="font-semibold text-slate-900">
                Contratos aguardando conclusão
              </p>
              <p className="text-sm text-slate-500">
                {dados.contratosPendentes} contrato(s)
              </p>
            </Link>

            <Link href="/reservas" className="block rounded-xl border p-4 hover:bg-slate-50">
              <p className="font-semibold text-slate-900">
                Ordens de Serviço pendentes
              </p>
              <p className="text-sm text-slate-500">
                {dados.osPendentes} OS pendente(s)
              </p>
            </Link>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Próximos eventos
              </h2>
              <p className="text-sm text-slate-500">
                Agenda operacional mais próxima.
              </p>
            </div>

            <Link href="/agenda" className="text-sm font-semibold text-pink-700">
              Ver agenda
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {dados.proximosEventos.map(reserva => (
              <Link
                key={reserva.id}
                href={`/reservas/${reserva.id}`}
                className="block rounded-xl border p-4 hover:bg-slate-50"
              >
                <p className="font-semibold text-slate-900">
                  {reserva.clientes?.nome || 'Cliente não informado'}
                </p>
                <p className="text-sm text-slate-500">
                  {reserva.data_evento}
                  {reserva.horario_evento ? ` às ${reserva.horario_evento}` : ''}
                  {' • '}
                  {reserva.kits?.nome || 'Kit não informado'}
                </p>
              </Link>
            ))}

            {!carregando && dados.proximosEventos.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum evento futuro encontrado.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Atividade recente do ERP
            </h2>
            <p className="text-sm text-slate-500">
              Últimos eventos processados pelo Workflow.
            </p>
          </div>

          <Link href="/workflow" className="text-sm font-semibold text-pink-700">
            Abrir Workflow
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {workflow.map(item => (
            <div key={item.id} className="rounded-xl border p-4">
              <p className="font-semibold text-slate-900">{item.titulo}</p>
              <p className="text-sm text-slate-500">
                {item.tipo} • {new Date(item.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}

          {!carregando && workflow.length === 0 && (
            <p className="text-sm text-slate-500">
              Nenhuma atividade recente encontrada.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
