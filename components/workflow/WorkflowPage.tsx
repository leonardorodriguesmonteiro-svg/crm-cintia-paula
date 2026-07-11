'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

type Evento = {
  id: string
  reserva_id: string
  tipo: string
  titulo: string
  descricao: string | null
  origem: string | null
  created_at: string
}

type Acao = {
  id: string
  evento_id: string
  modulo: string
  acao: string
  status: string
  erro: string | null
  executado_em: string | null
  created_at: string
}

export function WorkflowPage() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [acoes, setAcoes] = useState<Acao[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  const [busca, setBusca] = useState('')
  const [filtroEvento, setFiltroEvento] = useState('Todos')
  const [filtroStatus, setFiltroStatus] = useState('Todos')
  const [eventoAberto, setEventoAberto] = useState<string | null>(null)

  async function carregar() {
    setErro('')
    setCarregando(true)

    const eventosRes = await supabase
      .from('workflow_eventos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    const acoesRes = await supabase
      .from('workflow_acoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)

    if (eventosRes.error) setErro(eventosRes.error.message)
    else setEventos(eventosRes.data || [])

    if (acoesRes.error) setErro(acoesRes.error.message)
    else setAcoes(acoesRes.data || [])

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const tiposEvento = useMemo(() => {
    return Array.from(new Set(eventos.map(item => item.tipo))).sort()
  }, [eventos])

  const eventosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return eventos.filter(evento => {
      const acoesDoEvento = acoes.filter(acao => acao.evento_id === evento.id)

      const texto = [
        evento.titulo,
        evento.tipo,
        evento.descricao,
        evento.reserva_id,
        ...acoesDoEvento.map(acao => `${acao.modulo} ${acao.acao} ${acao.status} ${acao.erro || ''}`)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const passaEvento = filtroEvento === 'Todos' || evento.tipo === filtroEvento
      const passaStatus =
        filtroStatus === 'Todos' ||
        acoesDoEvento.some(acao => acao.status === filtroStatus)

      return passaBusca && passaEvento && passaStatus
    })
  }, [eventos, acoes, busca, filtroEvento, filtroStatus])

  const resumo = useMemo(() => {
    const executadas = acoes.filter(acao => acao.status === 'Executada').length
    const pendentes = acoes.filter(acao => acao.status === 'Pendente').length
    const erros = acoes.filter(acao => acao.status === 'Erro').length
    const total = acoes.length
    const taxaSucesso = total > 0 ? Math.round((executadas / total) * 100) : 0

    return {
      eventos: eventos.length,
      executadas,
      pendentes,
      erros,
      taxaSucesso
    }
  }, [eventos, acoes])

  function iconeStatus(status: string) {
    if (status === 'Executada') return '✅'
    if (status === 'Erro') return '❌'
    return '⏳'
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Centro de Workflow</h1>
          <p className="text-slate-500">
            Eventos, regras, ações automáticas e falhas do ERP.
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-sm text-slate-500">Eventos</p>
          <p className="mt-2 text-3xl font-bold">{resumo.eventos}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Executadas</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {resumo.executadas}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Pendentes</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">
            {resumo.pendentes}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Erros</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {resumo.erros}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Taxa de sucesso</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {resumo.taxaSucesso}%
          </p>
        </Card>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Buscar"
            placeholder="Reserva, evento, ação ou erro..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />

          <Select
            label="Evento"
            value={filtroEvento}
            onChange={e => setFiltroEvento(e.target.value)}
          >
            <option>Todos</option>
            {tiposEvento.map(tipo => (
              <option key={tipo}>{tipo}</option>
            ))}
          </Select>

          <Select
            label="Status da ação"
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
          >
            <option>Todos</option>
            <option>Executada</option>
            <option>Pendente</option>
            <option>Erro</option>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Replay do Workflow
          </h2>
          <p className="text-sm text-slate-500">
            {eventosFiltrados.length} evento(s) encontrado(s)
          </p>
        </div>

        {carregando ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="space-y-4">
            {eventosFiltrados.map(evento => {
              const acoesDoEvento = acoes.filter(
                acao => acao.evento_id === evento.id
              )

              const possuiErro = acoesDoEvento.some(
                acao => acao.status === 'Erro'
              )

              const aberto = eventoAberto === evento.id

              return (
                <div
                  key={evento.id}
                  className={`rounded-2xl border p-4 ${
                    possuiErro ? 'border-red-200 bg-red-50/30' : 'bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setEventoAberto(aberto ? null : evento.id)
                    }
                    className="w-full text-left"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {possuiErro ? '❌' : '✅'} {evento.titulo}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {evento.tipo} •{' '}
                          {new Date(evento.created_at).toLocaleString('pt-BR')}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Reserva: {evento.reserva_id}
                        </p>

                        {evento.descricao && (
                          <p className="mt-2 text-sm text-slate-600">
                            {evento.descricao}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {acoesDoEvento.length} ação(ões)
                        </span>

                        <span className="text-sm font-semibold text-pink-700">
                          {aberto ? 'Fechar' : 'Ver replay'}
                        </span>
                      </div>
                    </div>
                  </button>

                  {aberto && (
                    <div className="mt-5 border-t pt-5">
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="mt-1 h-3 w-3 rounded-full bg-pink-600" />
                          <div>
                            <p className="font-semibold text-slate-900">
                              Evento recebido
                            </p>
                            <p className="text-sm text-slate-500">
                              {new Date(evento.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>

                        {acoesDoEvento.map(acao => (
                          <div key={acao.id} className="flex gap-3">
                            <div
                              className={`mt-1 h-3 w-3 rounded-full ${
                                acao.status === 'Executada'
                                  ? 'bg-green-600'
                                  : acao.status === 'Erro'
                                    ? 'bg-red-600'
                                    : 'bg-yellow-500'
                              }`}
                            />

                            <div className="flex-1 rounded-xl border bg-slate-50 p-3">
                              <p className="font-semibold text-slate-900">
                                {iconeStatus(acao.status)} {acao.acao}
                              </p>

                              <p className="text-sm text-slate-500">
                                Módulo: {acao.modulo} • Status: {acao.status}
                              </p>

                              <p className="text-xs text-slate-400">
                                {new Date(
                                  acao.executado_em || acao.created_at
                                ).toLocaleString('pt-BR')}
                              </p>

                              {acao.erro && (
                                <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
                                  <strong>Erro:</strong> {acao.erro}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {acoesDoEvento.length === 0 && (
                          <p className="text-sm text-slate-400">
                            Nenhuma ação registrada para este evento.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {eventosFiltrados.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
                Nenhum evento encontrado com esses filtros.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
