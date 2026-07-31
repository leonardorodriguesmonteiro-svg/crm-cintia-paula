'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type Reserva = {
  id: string
  data_evento: string | null
  valor_total: number | null
  status: string | null
  clientes: { nome: string } | null
  kits: { nome: string | null } | null
}

type Recebimento = {
  id: string
  reserva_id: string
  valor: number
  data_recebimento: string | null
  forma_pagamento: string | null
  status: string | null
  observacoes: string | null
}

type LancamentoSinal = {
  id: string
  reserva_id: string | null
  descricao: string
  valor: number
  data_vencimento: string | null
  status: string
  provedor_pagamento: string | null
  link_pagamento: string | null
  status_provedor: string | null
  status_detalhe_provedor: string | null
  reservas: { clientes: { nome: string } | null } | null
}

const rotulosMercadoPago: Record<string, string> = {
  approved: 'Aprovado',
  pending: 'Pendente no Mercado Pago',
  in_process: 'Em análise',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
  charged_back: 'Contestado'
}

export function FinanceiroPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([])
  const [sinais, setSinais] = useState<LancamentoSinal[]>([])
  const [reservaId, setReservaId] = useState('')
  const [valor, setValor] = useState(0)
  const [forma, setForma] = useState('Pix')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    const reservasRes = await supabase
      .from('reservas')
      .select('id,data_evento,valor_total,status,clientes(nome),kits(nome)')
      .neq('status', 'Cancelada')
      .order('data_evento', { ascending: true })

    const recebimentosRes = await supabase
      .from('recebimentos')
      .select('*')
      .eq('status', 'Pago')
      .order('created_at', { ascending: false })

    const sinaisRes = await supabase
      .from('lancamentos_financeiros')
      .select('id,reserva_id,descricao,valor,data_vencimento,status,provedor_pagamento,link_pagamento,status_provedor,status_detalhe_provedor,reservas(clientes(nome))')
      .eq('categoria', 'Sinal')
      .order('data_vencimento', { ascending: true })

    if (reservasRes.error) setErro(reservasRes.error.message)
    else setReservas((reservasRes.data as any) || [])

    if (recebimentosRes.error) setErro(recebimentosRes.error.message)
    else setRecebimentos((recebimentosRes.data as any) || [])

    if (sinaisRes.error) setErro(sinaisRes.error.message)
    else setSinais((sinaisRes.data as unknown as LancamentoSinal[]) || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const totalContratado = reservas.reduce((t, r) => t + Number(r.valor_total || 0), 0)
  const totalRecebido = recebimentos.reduce((t, r) => t + Number(r.valor || 0), 0)
  const totalAReceber = Math.max(totalContratado - totalRecebido, 0)
  const sinaisPendentes = sinais.filter(item => item.status === 'Pendente')
  const totalSinaisPendentes = sinaisPendentes.reduce((total, item) => total + Number(item.valor || 0), 0)

  const resumoPorReserva = useMemo(() => {
    return reservas.map((reserva) => {
      const recebido = recebimentos
        .filter(r => r.reserva_id === reserva.id)
        .reduce((t, r) => t + Number(r.valor || 0), 0)

      const valorTotal = Number(reserva.valor_total || 0)
      const saldo = Math.max(valorTotal - recebido, 0)

      return { reserva, recebido, saldo, valorTotal }
    })
  }, [reservas, recebimentos])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return resumoPorReserva.filter(({ reserva }) => {
      const texto = [
        reserva.clientes?.nome,
        reserva.kits?.nome,
        reserva.data_evento,
        reserva.status
      ].filter(Boolean).join(' ').toLowerCase()

      return !termo || texto.includes(termo)
    })
  }, [resumoPorReserva, busca])

  async function registrarRecebimento(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!reservaId) return setErro('Selecione uma reserva.')
    if (Number(valor) <= 0) return setErro('Informe um valor maior que zero.')

    const { error } = await supabase.from('recebimentos').insert({
      reserva_id: reservaId,
      valor: Number(valor),
      data_recebimento: new Date().toISOString().slice(0, 10),
      forma_pagamento: forma,
      status: 'Pago',
      observacoes: 'Recebimento registrado pelo Financeiro.'
    })

    if (error) return setErro(error.message)

    setReservaId('')
    setValor(0)
    setForma('Pix')
    carregar()
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Financeiro</h1>
        <p className="text-slate-500">Controle recebimentos, saldo a receber e reservas.</p>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Valor contratado</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">R$ {totalContratado.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Total recebido</p>
          <p className="mt-2 text-3xl font-bold text-green-700">R$ {totalRecebido.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">A receber</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">R$ {totalAReceber.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Sinais pendentes</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">R$ {totalSinaisPendentes.toFixed(2)}</p>
          <p className="mt-1 text-xs text-slate-400">{sinaisPendentes.length} cobrança(s)</p>
        </Card>
      </div>

      <Card>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-slate-900">Cobranças de sinal</h2><p className="text-sm text-slate-500">Geradas automaticamente na formalização das vendas.</p></div>
          <Link href="/orcamentos" className="text-sm font-semibold text-pink-700">Abrir formalizações</Link>
        </div>
        <div className="space-y-3">
          {sinais.map(item => (
            <div key={item.id} className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{item.reservas?.clientes?.nome || item.descricao}</p>
                <p className="text-sm text-slate-500">Vencimento: {item.data_vencimento ? new Date(`${item.data_vencimento}T12:00:00`).toLocaleDateString('pt-BR') : '-'} · R$ {Number(item.valor).toFixed(2)}</p>
                {item.provedor_pagamento && (
                  <p className="mt-1 text-xs text-slate-500">
                    {item.provedor_pagamento}
                    {item.status_provedor ? ` · ${rotulosMercadoPago[item.status_provedor] || item.status_provedor}` : ' · Cobrança criada'}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.link_pagamento && item.status !== 'Pago' && (
                  <a
                    href={item.link_pagamento}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-pink-700 hover:bg-pink-50"
                  >
                    Abrir cobrança
                  </a>
                )}
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${item.status === 'Pago' ? 'bg-green-100 text-green-800' : item.status === 'Cancelado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{item.status}</span>
              </div>
            </div>
          ))}
          {sinais.length === 0 && <div className="rounded-2xl border border-dashed p-7 text-center text-slate-500">Nenhuma cobrança de sinal gerada.</div>}
        </div>
      </Card>

      <Card>
        <form onSubmit={registrarRecebimento} className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Registrar recebimento</h2>
            <p className="text-sm text-slate-500">Informe o pagamento recebido de uma reserva.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="Reserva" value={reservaId} onChange={e => setReservaId(e.target.value)}>
              <option value="">Selecione...</option>
              {resumoPorReserva.map(({ reserva, saldo }) => (
                <option key={reserva.id} value={reserva.id}>
                  {reserva.clientes?.nome || 'Cliente'} • {reserva.kits?.nome || 'Kit'} • Saldo: R$ {saldo.toFixed(2)}
                </option>
              ))}
            </Select>

            <Input label="Valor recebido" type="number" value={valor} onChange={e => setValor(Number(e.target.value))} />

            <Select label="Forma" value={forma} onChange={e => setForma(e.target.value)}>
              <option>Pix</option>
              <option>Cartão</option>
              <option>Dinheiro</option>
              <option>Transferência</option>
              <option>Boleto</option>
            </Select>
          </div>

          <Button type="submit">Registrar recebimento</Button>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reservas financeiras</h2>
            <p className="text-sm text-slate-500">{filtradas.length} reserva(s) encontrada(s)</p>
          </div>

          <Input placeholder="Buscar por cliente, kit ou data..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filtradas.map(({ reserva, recebido, saldo, valorTotal }) => (
            <div key={reserva.id} className="rounded-2xl border p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {reserva.clientes?.nome || 'Cliente não informado'}
                </p>
                <p className="text-sm text-slate-500">
                  {reserva.kits?.nome || 'Kit não informado'} • {reserva.data_evento || 'Sem data'}
                </p>
                <p className="text-sm text-slate-600">
                  Contratado: R$ {valorTotal.toFixed(2)} • Recebido: R$ {recebido.toFixed(2)} • Saldo: R$ {saldo.toFixed(2)}
                </p>
              </div>

              <span className={`text-xs rounded-full px-3 py-1 w-fit ${
                saldo <= 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
              }`}>
                {saldo <= 0 ? 'Quitado' : 'Em aberto'}
              </span>
            </div>
          ))}

          {filtradas.length === 0 && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
              Nenhuma reserva financeira encontrada.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
