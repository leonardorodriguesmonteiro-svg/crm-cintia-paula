'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Feedback = {
  id: string
  usuario_id: string | null
  empresa_id: string | null
  tipo: string
  mensagem: string
  pagina: string | null
  url: string | null
  status: string
  prioridade: string
  resposta: string | null
  resolvido_em: string | null
  created_at: string
}

const statusDisponiveis = [
  'Novo',
  'Em análise',
  'Planejado',
  'Em desenvolvimento',
  'Concluído',
  'Descartado'
]

const prioridadesDisponiveis = [
  'Não classificada',
  'Crítica',
  'Alta',
  'Média',
  'Baixa'
]

export function FeedbacksAdminPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState('Todos')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState<string | null>(null)

  async function carregar() {
    setErro('')
    setCarregando(true)

    const { data, error } = await supabase
      .from('feedbacks')
      .select(`
        id,
        usuario_id,
        empresa_id,
        tipo,
        mensagem,
        pagina,
        url,
        status,
        prioridade,
        resposta,
        resolvido_em,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    setFeedbacks(data || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const feedbacksFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return feedbacks.filter(item => {
      const correspondeBusca =
        !termo ||
        [
          item.tipo,
          item.mensagem,
          item.pagina,
          item.status,
          item.prioridade,
          item.resposta
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(termo)

      const correspondeStatus =
        filtroStatus === 'Todos' ||
        item.status === filtroStatus

      const correspondeTipo =
        filtroTipo === 'Todos' ||
        item.tipo === filtroTipo

      const correspondePrioridade =
        filtroPrioridade === 'Todos' ||
        item.prioridade === filtroPrioridade

      return (
        correspondeBusca &&
        correspondeStatus &&
        correspondeTipo &&
        correspondePrioridade
      )
    })
  }, [
    feedbacks,
    busca,
    filtroStatus,
    filtroTipo,
    filtroPrioridade
  ])

  const resumo = useMemo(() => {
    return {
      total: feedbacks.length,
      novos: feedbacks.filter(item => item.status === 'Novo').length,
      criticos: feedbacks.filter(
        item => item.prioridade === 'Crítica'
      ).length,
      concluidos: feedbacks.filter(
        item => item.status === 'Concluído'
      ).length
    }
  }, [feedbacks])

  async function atualizarFeedback(
    id: string,
    alteracoes: Partial<Feedback>
  ) {
    setErro('')
    setSalvandoId(id)

    const payload: Record<string, unknown> = {
      ...alteracoes,
      updated_at: new Date().toISOString()
    }

    if (alteracoes.status === 'Concluído') {
      payload.resolvido_em = new Date().toISOString()
    }

    if (
      alteracoes.status &&
      alteracoes.status !== 'Concluído'
    ) {
      payload.resolvido_em = null
    }

    const { error } = await supabase
      .from('feedbacks')
      .update(payload)
      .eq('id', id)

    if (error) {
      setErro(error.message)
      setSalvandoId(null)
      return
    }

    setFeedbacks(atuais =>
      atuais.map(item =>
        item.id === id
          ? {
              ...item,
              ...alteracoes,
              resolvido_em:
                alteracoes.status === 'Concluído'
                  ? new Date().toISOString()
                  : alteracoes.status
                    ? null
                    : item.resolvido_em
            }
          : item
      )
    )

    setSalvandoId(null)
  }

  function corTipo(tipo: string) {
    if (tipo === 'Erro') {
      return 'bg-red-50 text-red-700'
    }

    if (tipo === 'Dificuldade') {
      return 'bg-yellow-50 text-yellow-700'
    }

    if (tipo === 'Elogio') {
      return 'bg-green-50 text-green-700'
    }

    return 'bg-blue-50 text-blue-700'
  }

  function corPrioridade(prioridade: string) {
    if (prioridade === 'Crítica') {
      return 'bg-red-100 text-red-800'
    }

    if (prioridade === 'Alta') {
      return 'bg-orange-100 text-orange-800'
    }

    if (prioridade === 'Média') {
      return 'bg-yellow-100 text-yellow-800'
    }

    if (prioridade === 'Baixa') {
      return 'bg-green-100 text-green-800'
    }

    return 'bg-slate-100 text-slate-600'
  }

  return (
    <div className="space-y-6 p-4 pb-28 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">
            ADMINISTRAÇÃO
          </p>

          <h1 className="text-3xl font-bold text-slate-900">
            Central de Feedback
          </h1>

          <p className="text-slate-500">
            Acompanhe sugestões, dificuldades, erros e elogios enviados no ERP.
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
        <div className="rounded-3xl border bg-white p-5">
          <p className="text-sm text-slate-500">Total</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {resumo.total}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <p className="text-sm text-slate-500">Novos</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            {resumo.novos}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <p className="text-sm text-slate-500">Críticos</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {resumo.criticos}
          </p>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <p className="text-sm text-slate-500">Concluídos</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {resumo.concluidos}
          </p>
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            placeholder="Buscar feedback..."
            value={busca}
            onChange={evento => setBusca(evento.target.value)}
          />

          <Select
            label="Status"
            value={filtroStatus}
            onChange={evento =>
              setFiltroStatus(evento.target.value)
            }
          >
            <option>Todos</option>

            {statusDisponiveis.map(status => (
              <option key={status}>{status}</option>
            ))}
          </Select>

          <Select
            label="Tipo"
            value={filtroTipo}
            onChange={evento =>
              setFiltroTipo(evento.target.value)
            }
          >
            <option>Todos</option>
            <option>Erro</option>
            <option>Dificuldade</option>
            <option>Sugestão</option>
            <option>Elogio</option>
          </Select>

          <Select
            label="Prioridade"
            value={filtroPrioridade}
            onChange={evento =>
              setFiltroPrioridade(evento.target.value)
            }
          >
            <option>Todos</option>

            {prioridadesDisponiveis.map(prioridade => (
              <option key={prioridade}>{prioridade}</option>
            ))}
          </Select>
        </div>
      </div>

      {carregando ? (
        <div className="rounded-3xl border bg-white p-8 text-slate-500">
          Carregando feedbacks...
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacksFiltrados.map(item => (
            <article
              key={item.id}
              className="rounded-3xl border bg-white p-5 md:p-6"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${corTipo(item.tipo)}`}
                    >
                      {item.tipo}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${corPrioridade(item.prioridade)}`}
                    >
                      {item.prioridade}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap text-slate-800">
                    {item.mensagem}
                  </p>

                  <div className="mt-4 space-y-1 text-xs text-slate-500">
                    <p>
                      <strong>Página:</strong>{' '}
                      {item.pagina || '-'}
                    </p>

                    <p>
                      <strong>Enviado em:</strong>{' '}
                      {new Date(item.created_at).toLocaleString(
                        'pt-BR'
                      )}
                    </p>

                    {item.url && (
                      <p className="break-all">
                        <strong>URL:</strong>{' '}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-pink-700 hover:underline"
                        >
                          {item.url}
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid w-full gap-3 xl:w-80">
                  <Select
                    label="Prioridade"
                    value={item.prioridade}
                    disabled={salvandoId === item.id}
                    onChange={evento =>
                      atualizarFeedback(item.id, {
                        prioridade: evento.target.value
                      })
                    }
                  >
                    {prioridadesDisponiveis.map(prioridade => (
                      <option key={prioridade}>
                        {prioridade}
                      </option>
                    ))}
                  </Select>

                  <Select
                    label="Status"
                    value={item.status}
                    disabled={salvandoId === item.id}
                    onChange={evento =>
                      atualizarFeedback(item.id, {
                        status: evento.target.value
                      })
                    }
                  >
                    {statusDisponiveis.map(status => (
                      <option key={status}>{status}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-5 border-t pt-5">
                <Textarea
                  label="Resposta da administração"
                  placeholder="Registre a análise, a solução aplicada ou uma resposta para o usuário..."
                  value={item.resposta || ''}
                  disabled={salvandoId === item.id}
                  onChange={evento => {
                    const resposta = evento.target.value

                    setFeedbacks(atuais =>
                      atuais.map(feedback =>
                        feedback.id === item.id
                          ? { ...feedback, resposta }
                          : feedback
                      )
                    )
                  }}
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={salvandoId === item.id}
                    onClick={() =>
                      atualizarFeedback(item.id, {
                        resposta: item.resposta || ''
                      })
                    }
                  >
                    {salvandoId === item.id
                      ? 'Salvando...'
                      : 'Salvar resposta'}
                  </Button>

                  {item.status !== 'Concluído' && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={salvandoId === item.id}
                      onClick={() =>
                        atualizarFeedback(item.id, {
                          status: 'Concluído',
                          resposta: item.resposta || ''
                        })
                      }
                    >
                      Marcar como concluído
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}

          {feedbacksFiltrados.length === 0 && (
            <div className="rounded-3xl border border-dashed bg-white p-10 text-center text-slate-500">
              Nenhum feedback encontrado.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
