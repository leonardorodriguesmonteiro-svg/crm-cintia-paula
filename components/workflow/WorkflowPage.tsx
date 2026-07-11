'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'

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

  async function carregar() {
    setErro('')
    setCarregando(true)

    const eventosRes = await supabase
      .from('workflow_eventos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    const acoesRes = await supabase
      .from('workflow_acoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (eventosRes.error) setErro(eventosRes.error.message)
    else setEventos(eventosRes.data || [])

    if (acoesRes.error) setErro(acoesRes.error.message)
    else setAcoes(acoesRes.data || [])

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const resumo = useMemo(() => {
    return {
      eventos: eventos.length,
      executadas: acoes.filter(a => a.status === 'Executada').length,
      pendentes: acoes.filter(a => a.status === 'Pendente').length,
      erros: acoes.filter(a => a.status === 'Erro').length
    }
  }, [eventos, acoes])

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Centro de Workflow</h1>
        <p className="text-slate-500">
          Acompanhe os eventos, regras e ações automáticas do ERP.
        </p>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Eventos recentes</p>
          <p className="mt-2 text-3xl font-bold">{resumo.eventos}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Ações executadas</p>
          <p className="mt-2 text-3xl font-bold text-green-700">{resumo.executadas}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Pendentes</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">{resumo.pendentes}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Erros</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{resumo.erros}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Últimos eventos</h2>

        {carregando ? (
          <p className="mt-4 text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="mt-4 space-y-3">
            {eventos.map(evento => {
              const acoesDoEvento = acoes.filter(a => a.evento_id === evento.id)

              return (
                <div key={evento.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{evento.titulo}</p>
                      <p className="text-sm text-slate-500">
                        {evento.tipo} • {new Date(evento.created_at).toLocaleString('pt-BR')}
                      </p>
                      {evento.descricao && (
                        <p className="mt-1 text-sm text-slate-600">{evento.descricao}</p>
                      )}
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {acoesDoEvento.length} ação(ões)
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {acoesDoEvento.map(acao => (
                      <div key={acao.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <p className="font-semibold">
                          {acao.status === 'Executada' ? '✅' : acao.status === 'Erro' ? '❌' : '⏳'}{' '}
                          {acao.acao}
                        </p>
                        <p className="text-slate-500">
                          {acao.modulo} • {acao.status}
                        </p>
                        {acao.erro && (
                          <p className="mt-1 text-red-700">{acao.erro}</p>
                        )}
                      </div>
                    ))}

                    {acoesDoEvento.length === 0 && (
                      <p className="text-sm text-slate-400">Nenhuma ação registrada.</p>
                    )}
                  </div>
                </div>
              )
            })}

            {eventos.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
                Nenhum evento de Workflow encontrado.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
