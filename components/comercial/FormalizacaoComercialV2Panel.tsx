'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  FileSignature,
  HandCoins,
  Mail,
  RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type PropostaV2 = {
  id: string
  numero: number
  status: string
  total: number
  formalizacao_status: string | null
  dados_cliente_completos_em: string | null
  hold_expira_em: string | null
  formalizacao_bloqueio: string | null
  reserva_id: string | null
  contrato_id: string | null
  lancamento_sinal_id: string | null
  valor_sinal_formalizacao: number | null
  vencimento_sinal: string | null
  contrato_assinado_em: string | null
  sinal_pago_em: string | null
  clientes: {
    nome: string
    email: string | null
    whatsapp: string | null
  } | null
  contratos: {
    id: string
    status: string | null
    public_token: string | null
    email_enviado_em: string | null
    email_destino: string | null
  } | null
  lancamentos_financeiros: {
    status: string | null
    link_pagamento: string | null
    status_provedor: string | null
  } | null
}

function moeda(valor: number | string | null | undefined) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function vencimentoInicial() {
  const data = new Date()
  data.setDate(data.getDate() + 2)
  return data.toISOString().slice(0, 10)
}

const rotulosStatus: Record<string, string> = {
  AGUARDANDO_DADOS: 'Aguardando dados do cliente',
  DADOS_COMPLETOS: 'Dados completos',
  CONTRATO_GERADO: 'Contrato gerado',
  CONTRATO_ENVIADO: 'Contrato enviado',
  AGUARDANDO_ASSINATURA: 'Aguardando assinatura',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PRONTA_PARA_CONFIRMAR: 'Pronta para confirmar',
  RESERVA_CONFIRMADA: 'Reserva confirmada',
  CANCELADA: 'Cancelada'
}

function corStatus(status: string | null) {
  if (status === 'RESERVA_CONFIRMADA') return 'bg-green-100 text-green-800'
  if (status === 'PRONTA_PARA_CONFIRMAR') return 'bg-cyan-100 text-cyan-800'
  if (status === 'AGUARDANDO_PAGAMENTO') return 'bg-blue-100 text-blue-800'
  if (status === 'AGUARDANDO_ASSINATURA') return 'bg-purple-100 text-purple-800'
  if (status === 'CANCELADA') return 'bg-red-100 text-red-800'
  if (status === 'DADOS_COMPLETOS') return 'bg-emerald-100 text-emerald-800'
  return 'bg-amber-100 text-amber-800'
}

function formatarDataHora(valor: string | null) {
  if (!valor) return null
  return new Date(valor).toLocaleString('pt-BR')
}

export function FormalizacaoComercialV2Panel() {
  const [propostas, setPropostas] = useState<PropostaV2[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [processando, setProcessando] = useState<string | null>(null)
  const [valoresSinal, setValoresSinal] = useState<Record<string, string>>({})
  const [vencimentos, setVencimentos] = useState<Record<string, string>>({})

  async function carregar() {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase
      .from('orcamentos')
      .select(`
        id,
        numero,
        status,
        total,
        formalizacao_status,
        dados_cliente_completos_em,
        hold_expira_em,
        formalizacao_bloqueio,
        reserva_id,
        contrato_id,
        lancamento_sinal_id,
        valor_sinal_formalizacao,
        vencimento_sinal,
        contrato_assinado_em,
        sinal_pago_em,
        clientes(nome,email,whatsapp),
        contratos(id,status,public_token,email_enviado_em,email_destino),
        lancamentos_financeiros(status,link_pagamento,status_provedor)
      `)
      .eq('status', 'ACEITA')
      .order('respondido_em', { ascending: false })

    if (error) {
      // Antes da migration V2 entrar em produção, a tela legada continua útil.
      // Não derrubamos /orcamentos por falta temporária das colunas novas.
      if (
        error.message.includes('dados_cliente_completos_em')
        || error.message.includes('hold_expira_em')
        || error.message.includes('formalizacao_bloqueio')
      ) {
        setPropostas([])
        setCarregando(false)
        return
      }
      setErro(error.message)
      setCarregando(false)
      return
    }

    setPropostas((data as unknown as PropostaV2[]) || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const pendentes = useMemo(
    () => propostas.filter(item => item.formalizacao_status !== 'RESERVA_CONFIRMADA'),
    [propostas]
  )

  async function tokenSessao() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')
    return token
  }

  async function formalizar(proposta: PropostaV2) {
    setErro('')
    setSucesso('')
    setProcessando(`formalizar:${proposta.id}`)

    try {
      const token = await tokenSessao()
      const valorPadrao = proposta.valor_sinal_formalizacao
        || Math.max(Number(proposta.total || 0) * 0.3, 1)
      const valor = Number(valoresSinal[proposta.id] ?? valorPadrao)
      const vencimento = vencimentos[proposta.id]
        ?? proposta.vencimento_sinal
        ?? vencimentoInicial()

      const resposta = await fetch(`/api/orcamentos/${proposta.id}/formalizacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          acao: 'formalizar',
          valor_sinal: valor,
          vencimento
        })
      })
      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível formalizar a proposta.')

      setSucesso(corpo.mensagem || 'Contrato e cobrança preparados com sucesso.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível formalizar a proposta.')
    } finally {
      setProcessando(null)
    }
  }

  async function executarAcao(
    proposta: PropostaV2,
    acao: 'confirmar_assinatura' | 'confirmar_sinal'
  ) {
    setErro('')
    setSucesso('')
    setProcessando(`${acao}:${proposta.id}`)

    try {
      const token = await tokenSessao()
      const resposta = await fetch(`/api/orcamentos/${proposta.id}/formalizacao`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          acao,
          ...(acao === 'confirmar_sinal' ? { forma_pagamento: 'Pix' } : {})
        })
      })
      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível concluir a ação.')

      setSucesso(corpo.mensagem || 'Formalização atualizada.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir a ação.')
    } finally {
      setProcessando(null)
    }
  }

  async function enviarContrato(proposta: PropostaV2) {
    if (!proposta.contrato_id) return
    setErro('')
    setSucesso('')
    setProcessando(`email:${proposta.id}`)

    try {
      const token = await tokenSessao()
      const resposta = await fetch(`/api/contratos/${proposta.contrato_id}/enviar-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reenviar: Boolean(proposta.contratos?.email_enviado_em)
        })
      })
      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível enviar o contrato.')

      setSucesso(corpo.mensagem || 'Contrato enviado ao cliente.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar o contrato.')
    } finally {
      setProcessando(null)
    }
  }

  async function copiarLink(proposta: PropostaV2) {
    const token = proposta.contratos?.public_token
    if (!token) return setErro('O contrato ainda não possui link público.')

    const link = `${window.location.origin}/contrato/${token}`
    try {
      await navigator.clipboard.writeText(link)
      setSucesso('Link do contrato copiado.')
    } catch {
      setErro('Não foi possível copiar o link automaticamente.')
    }
  }

  if (!carregando && propostas.length === 0) return null

  return (
    <section className="space-y-4 rounded-3xl border border-pink-200 bg-pink-50/40 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-pink-700">Jornada Comercial V2</p>
          <h2 className="text-xl font-bold text-slate-900">Formalizações em andamento</h2>
          <p className="mt-1 text-sm text-slate-600">
            A reserva só é confirmada quando contrato e pagamento estiverem concluídos.
          </p>
        </div>
        <Button variant="secondary" onClick={carregar} disabled={carregando}>
          <RefreshCw size={16} className="mr-1 inline" /> {carregando ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      {carregando ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Carregando formalizações...</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {propostas.map(proposta => {
            const status = proposta.formalizacao_status || 'AGUARDANDO_DADOS'
            const valorPadrao = proposta.valor_sinal_formalizacao
              || Math.max(Number(proposta.total || 0) * 0.3, 1)
            const assinaturaOk = Boolean(proposta.contrato_assinado_em)
              || proposta.contratos?.status === 'Assinado'
            const pagamentoOk = Boolean(proposta.sinal_pago_em)
              || proposta.lancamentos_financeiros?.status === 'Pago'
            const dadosOk = Boolean(proposta.dados_cliente_completos_em)
            const confirmada = status === 'RESERVA_CONFIRMADA'

            return (
              <article key={proposta.id} className="rounded-2xl border bg-white p-4 shadow-sm md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-pink-700">ORC-{String(proposta.numero).padStart(4, '0')}</p>
                    <h3 className="font-bold text-slate-900">{proposta.clientes?.nome || 'Cliente'}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{moeda(proposta.total)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${corStatus(status)}`}>
                    {rotulosStatus[status] || status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {[
                    ['Dados', dadosOk],
                    ['Contrato', Boolean(proposta.contrato_id)],
                    ['Assinatura', assinaturaOk],
                    ['Pagamento', pagamentoOk]
                  ].map(([rotulo, concluido]) => (
                    <div
                      key={String(rotulo)}
                      className={`rounded-xl border px-3 py-2 ${concluido ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                    >
                      <p className="flex items-center gap-1 font-semibold">
                        {concluido ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
                        {String(rotulo)}
                      </p>
                    </div>
                  ))}
                </div>

                {proposta.hold_expira_em && !confirmada && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <Clock3 size={14} /> Hold comercial até {formatarDataHora(proposta.hold_expira_em)}.
                  </div>
                )}

                {proposta.formalizacao_bloqueio && (
                  <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {proposta.formalizacao_bloqueio}
                  </div>
                )}

                {status === 'AGUARDANDO_DADOS' && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    O cliente aceitou a proposta. Aguardando o complemento dos dados cadastrais no link público.
                  </div>
                )}

                {status === 'DADOS_COMPLETOS' && !proposta.contrato_id && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="Valor do sinal"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={valoresSinal[proposta.id] ?? String(valorPadrao.toFixed(2))}
                        onChange={evento => setValoresSinal(atual => ({ ...atual, [proposta.id]: evento.target.value }))}
                      />
                      <Input
                        label="Vencimento"
                        type="date"
                        value={vencimentos[proposta.id] ?? proposta.vencimento_sinal ?? vencimentoInicial()}
                        onChange={evento => setVencimentos(atual => ({ ...atual, [proposta.id]: evento.target.value }))}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={processando === `formalizar:${proposta.id}`}
                      onClick={() => formalizar(proposta)}
                    >
                      <FileSignature size={16} className="mr-1 inline" />
                      {processando === `formalizar:${proposta.id}` ? 'Preparando...' : 'Gerar reserva provisória e contrato'}
                    </Button>
                  </div>
                )}

                {proposta.contrato_id && !confirmada && (
                  <div className="mt-4 space-y-2">
                    {!assinaturaOk && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          disabled={processando === `email:${proposta.id}`}
                          onClick={() => enviarContrato(proposta)}
                        >
                          <Mail size={16} className="mr-1 inline" />
                          {processando === `email:${proposta.id}`
                            ? 'Enviando...'
                            : proposta.contratos?.email_enviado_em
                              ? 'Reenviar contrato'
                              : 'Enviar contrato'}
                        </Button>
                        <Button variant="secondary" onClick={() => copiarLink(proposta)}>
                          <Copy size={16} className="mr-1 inline" /> Copiar link
                        </Button>
                      </div>
                    )}

                    {proposta.contratos?.public_token && (
                      <a
                        href={`/contrato/${proposta.contratos.public_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-semibold text-pink-700 hover:bg-pink-100"
                      >
                        <ExternalLink size={14} /> Abrir página pública do contrato
                      </a>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      {!assinaturaOk && (
                        <Button
                          variant="secondary"
                          disabled={processando === `confirmar_assinatura:${proposta.id}`}
                          onClick={() => executarAcao(proposta, 'confirmar_assinatura')}
                        >
                          <FileSignature size={16} className="mr-1 inline" /> Confirmar assinatura manual
                        </Button>
                      )}
                      {!pagamentoOk && (
                        <Button
                          variant="secondary"
                          disabled={processando === `confirmar_sinal:${proposta.id}`}
                          onClick={() => executarAcao(proposta, 'confirmar_sinal')}
                        >
                          <HandCoins size={16} className="mr-1 inline" /> Confirmar sinal manual
                        </Button>
                      )}
                    </div>

                    {proposta.lancamentos_financeiros?.link_pagamento && !pagamentoOk && (
                      <a
                        href={proposta.lancamentos_financeiros.link_pagamento}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                      >
                        <ExternalLink size={14} /> Abrir cobrança Mercado Pago
                      </a>
                    )}
                  </div>
                )}

                {confirmada && proposta.reserva_id && (
                  <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
                    <p className="font-bold">Reserva confirmada.</p>
                    <p className="mt-1 text-xs">Contrato e sinal foram validados antes da confirmação.</p>
                    <Link
                      href={`/reservas/${proposta.reserva_id}`}
                      className="mt-2 inline-flex items-center gap-1 font-semibold text-green-900 hover:underline"
                    >
                      Abrir reserva <ExternalLink size={13} />
                    </Link>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {!carregando && pendentes.length === 0 && propostas.length > 0 && (
        <p className="text-xs text-slate-500">Todas as propostas V2 exibidas já foram confirmadas.</p>
      )}
    </section>
  )
}
