'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

type Reserva = {
  id: string
  data_evento: string
  horario_evento: string | null
  endereco_evento: string | null
  status: string | null
  valor_total: number | null
  clientes: { nome: string } | null
  kits: { nome: string; codigo: string | null } | null
}

const statusClass: Record<string, string> = {
  Pendente: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Confirmada: 'bg-green-50 text-green-700 border-green-200',
  'Em andamento': 'bg-blue-50 text-blue-700 border-blue-200',
  Concluída: 'bg-slate-100 text-slate-700 border-slate-200',
  Cancelada: 'bg-red-50 text-red-700 border-red-200'
}

export function AgendaPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('Todos')
  const [mesAtual, setMesAtual] = useState(new Date())

  async function carregar() {
    const { data, error } = await supabase
      .from('reservas')
      .select('id,data_evento,horario_evento,endereco_evento,status,valor_total,clientes(nome),kits(nome,codigo)')
      .order('data_evento', { ascending: true })

    if (error) return setErro(error.message)
    setReservas((data as any) || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return reservas.filter((reserva: any) => {
      const kit = Array.isArray(reserva.kits) ? reserva.kits[0] : reserva.kits
      const cliente = Array.isArray(reserva.clientes) ? reserva.clientes[0] : reserva.clientes

      const texto = [
        reserva.data_evento,
        reserva.horario_evento,
        reserva.status,
        cliente?.nome,
        kit?.nome,
        kit?.codigo,
        reserva.endereco_evento
      ].filter(Boolean).join(' ').toLowerCase()

      const passaBusca = !termo || texto.includes(termo)
      const passaStatus = status === 'Todos' || reserva.status === status

      return passaBusca && passaStatus
    })
  }, [reservas, busca, status])

  const ano = mesAtual.getFullYear()
  const mes = mesAtual.getMonth()

  const diasDoMes = useMemo(() => {
    const primeiroDia = new Date(ano, mes, 1)
    const ultimoDia = new Date(ano, mes + 1, 0)
    const inicioSemana = primeiroDia.getDay()
    const totalDias = ultimoDia.getDate()

    const dias: Array<{ data: Date | null; chave: string | null }> = []

    for (let i = 0; i < inicioSemana; i++) {
      dias.push({ data: null, chave: null })
    }

    for (let dia = 1; dia <= totalDias; dia++) {
      const data = new Date(ano, mes, dia)
      const chave = data.toISOString().slice(0, 10)
      dias.push({ data, chave })
    }

    return dias
  }, [ano, mes])

  const reservasPorDia = useMemo(() => {
    return filtradas.reduce<Record<string, Reserva[]>>((acc, reserva) => {
      const data = reserva.data_evento
      if (!acc[data]) acc[data] = []
      acc[data].push(reserva)
      return acc
    }, {})
  }, [filtradas])

  function mesAnterior() {
    setMesAtual(new Date(ano, mes - 1, 1))
  }

  function proximoMes() {
    setMesAtual(new Date(ano, mes + 1, 1))
  }

  const nomeMes = mesAtual.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Agenda</h1>
          <p className="text-slate-500">Visualize reservas no calendário mensal.</p>
        </div>

        <Link href="/reservas">
          <Button>Nova reserva</Button>
        </Link>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Buscar"
            placeholder="Cliente, kit, código, endereço..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Todos</option>
            <option>Pendente</option>
            <option>Confirmada</option>
            <option>Em andamento</option>
            <option>Concluída</option>
            <option>Cancelada</option>
          </Select>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-5">
          <Button variant="secondary" onClick={mesAnterior}>Mês anterior</Button>
          <h2 className="text-lg md:text-xl font-bold text-slate-900 capitalize">{nomeMes}</h2>
          <Button variant="secondary" onClick={proximoMes}>Próximo mês</Button>
        </div>

        <div className="hidden md:grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold uppercase text-slate-400">
          <div>Dom</div>
          <div>Seg</div>
          <div>Ter</div>
          <div>Qua</div>
          <div>Qui</div>
          <div>Sex</div>
          <div>Sáb</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {diasDoMes.map((dia, index) => {
            if (!dia.data || !dia.chave) {
              return <div key={index} className="hidden md:block min-h-28 rounded-2xl border bg-slate-50" />
            }

            const lista = reservasPorDia[dia.chave] || []

            return (
              <div key={dia.chave} className="min-h-28 rounded-2xl border bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {dia.data.getDate()}
                  </span>
                  <span className="md:hidden text-xs text-slate-500 capitalize">
                    {dia.data.toLocaleDateString('pt-BR', { weekday: 'long' })}
                  </span>
                </div>

                <div className="space-y-2">
                  {lista.slice(0, 3).map((reserva: any) => {
                    const kit = Array.isArray(reserva.kits) ? reserva.kits[0] : reserva.kits
                    const cliente = Array.isArray(reserva.clientes) ? reserva.clientes[0] : reserva.clientes
                    const classe = statusClass[reserva.status || ''] || 'bg-slate-50 text-slate-700 border-slate-200'

                    return (
                      <Link key={reserva.id} href="/reservas">
                        <div className={`rounded-xl border px-2 py-1.5 text-xs ${classe}`}>
                          <p className="font-semibold truncate">
                            {reserva.horario_evento || '--:--'} • {cliente?.nome || 'Cliente'}
                          </p>
                          <p className="truncate">
                            {kit?.nome || 'Kit'}
                          </p>
                        </div>
                      </Link>
                    )
                  })}

                  {lista.length > 3 && (
                    <p className="text-xs text-slate-500">+ {lista.length - 3} reserva(s)</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
