'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Reserva = {
  id: string
  data_evento: string | null
  horario_evento: string | null
  valor_total: number | null
  valor_sinal: number | null
  status: string | null
  clientes: { nome: string } | null
  kits: { nome: string; codigo: string | null } | null
}

type EstoqueItem = {
  id: string
  nome: string
  quantidade_total: number | null
  quantidade_disponivel: number | null
  quantidade_manutencao: number | null
}

export function DashboardPage() {
  const [clientes, setClientes] = useState(0)
  const [kits, setKits] = useState(0)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [estoque, setEstoque] = useState<EstoqueItem[]>([])
  const [erro, setErro] = useState('')

  async function carregar() {
    const clientesRes = await supabase.from('clientes').select('id', { count: 'exact', head: true })
    const kitsRes = await supabase.from('kits').select('id', { count: 'exact', head: true })

    const reservasRes = await supabase
      .from('reservas')
      .select('id,data_evento,horario_evento,valor_total,valor_sinal,status,clientes(nome),kits(nome,codigo)')
      .order('data_evento', { ascending: true })

    const estoqueRes = await supabase
      .from('estoque_itens')
      .select('id,nome,quantidade_total,quantidade_disponivel,quantidade_manutencao')

    if (clientesRes.error) setErro(clientesRes.error.message)
    else setClientes(clientesRes.count || 0)

    if (kitsRes.error) setErro(kitsRes.error.message)
    else setKits(kitsRes.count || 0)

    if (reservasRes.error) setErro(reservasRes.error.message)
    else setReservas((reservasRes.data as any) || [])

    if (estoqueRes.error) setErro(estoqueRes.error.message)
    else setEstoque(estoqueRes.data || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const hoje = new Date().toISOString().slice(0, 10)

  const reservasHoje = useMemo(
    () => reservas.filter(r => r.data_evento === hoje && r.status !== 'Cancelada'),
    [reservas, hoje]
  )

  const proximasReservas = useMemo(
    () => reservas
      .filter(r => r.data_evento && r.data_evento >= hoje && r.status !== 'Cancelada')
      .slice(0, 5),
    [reservas, hoje]
  )

  const reservasMes = useMemo(() => {
    const agora = new Date()
    const mes = agora.getMonth()
    const ano = agora.getFullYear()

    return reservas.filter(r => {
      if (!r.data_evento || r.status === 'Cancelada') return false
      const data = new Date(r.data_evento + 'T00:00:00')
      return data.getMonth() === mes && data.getFullYear() === ano
    })
  }, [reservas])

  const receitaPrevistaMes = reservasMes.reduce((total, r) => total + Number(r.valor_total || 0), 0)
  const aReceberMes = reservasMes.reduce((total, r) => total + Math.max(Number(r.valor_total || 0) - Number(r.valor_sinal || 0), 0), 0)

  const itensManutencao = estoque.filter(item => Number(item.quantidade_manutencao || 0) > 0)
  const itensCriticos = estoque.filter(item => Number(item.quantidade_disponivel || 0) <= 0)

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bom dia, Cíntia 👋</h1>
          <p className="text-slate-500">Resumo executivo da operação.</p>
        </div>

        <div className="flex gap-2">
          <Link href="/reservas"><Button>Nova reserva</Button></Link>
          <Link href="/agenda"><Button variant="secondary">Ver agenda</Button></Link>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Festas hoje</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{reservasHoje.length}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Reservas do mês</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{reservasMes.length}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Receita prevista</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            R$ {receitaPrevistaMes.toFixed(2)}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">A receber</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            R$ {aReceberMes.toFixed(2)}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Clientes</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{clientes}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Kits cadastrados</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{kits}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Itens em manutenção</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{itensManutencao.length}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Estoque crítico</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{itensCriticos.length}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Próximas reservas</h2>
              <p className="text-sm text-slate-500">Agenda operacional dos próximos eventos.</p>
            </div>
            <Link href="/agenda" className="text-sm font-semibold text-pink-700">Ver agenda</Link>
          </div>

          <div className="space-y-3">
            {proximasReservas.map((reserva) => (
              <div key={reserva.id} className="rounded-2xl border p-4">
                <p className="font-semibold text-slate-900">
                  {reserva.data_evento} {reserva.horario_evento ? `• ${reserva.horario_evento}` : ''}
                </p>
                <p className="text-sm text-slate-500">
                  {reserva.clientes?.nome || 'Cliente'} • {reserva.kits?.nome || 'Kit'}
                </p>
                <span className="mt-2 inline-flex rounded-full bg-pink-50 px-3 py-1 text-xs text-pink-700">
                  {reserva.status}
                </span>
              </div>
            ))}

            {proximasReservas.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
                Nenhuma reserva futura encontrada.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Alertas operacionais</h2>
            <p className="text-sm text-slate-500">Pontos que exigem atenção.</p>
          </div>

          <div className="space-y-3">
            {itensCriticos.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="font-semibold text-red-800">{item.nome}</p>
                <p className="text-sm text-red-700">Sem quantidade disponível no estoque.</p>
              </div>
            ))}

            {itensManutencao.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4">
                <p className="font-semibold text-yellow-800">{item.nome}</p>
                <p className="text-sm text-yellow-700">
                  {item.quantidade_manutencao} unidade(s) em manutenção.
                </p>
              </div>
            ))}

            {itensCriticos.length === 0 && itensManutencao.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
                Nenhum alerta operacional no momento.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
