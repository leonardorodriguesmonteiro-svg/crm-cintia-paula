'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

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

export function AgendaPage() {
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('Todos')

  async function carregar() {
    const { data, error } = await supabase
      .from('reservas')
      .select('id,data_evento,horario_evento,endereco_evento,status,valor_total,clientes(nome),kits(nome,codigo)')
      .order('data_evento', { ascending: true })

    if (error) {
      setErro(error.message)
      return
    }

    setReservas((data as any) || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase()

    return reservas.filter((reserva) => {
      const texto = [
        reserva.data_evento,
        reserva.horario_evento,
        reserva.status,
        reserva.clientes?.nome,
        reserva.kits?.nome,
        reserva.endereco_evento
      ].join(' ').toLowerCase()

      const passaBusca = texto.includes(termo)
      const passaStatus = status === 'Todos' || reserva.status === status

      return passaBusca && passaStatus
    })
  }, [reservas, busca, status])

  const agrupadas = useMemo(() => {
    return filtradas.reduce<Record<string, Reserva[]>>((acc, reserva) => {
      const data = reserva.data_evento || 'Sem data'
      if (!acc[data]) acc[data] = []
      acc[data].push(reserva)
      return acc
    }, {})
  }, [filtradas])

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Agenda</h1>
        <p className="text-slate-500">Visualize as reservas organizadas por data.</p>
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
            placeholder="Cliente, kit, endereço..."
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

      <div className="space-y-5">
        {Object.entries(agrupadas).map(([data, lista]) => (
          <Card key={data}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                })}
              </h2>
              <p className="text-sm text-slate-500">{lista.length} reserva(s)</p>
            </div>

            <div className="space-y-3">
              {lista.map((reserva) => (
                <div key={reserva.id} className="rounded-2xl border p-4 bg-white">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {reserva.horario_evento || 'Horário não informado'} • {reserva.clientes?.nome || 'Cliente não informado'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {reserva.kits?.codigo ? `${reserva.kits.codigo} - ` : ''}{reserva.kits?.nome || 'Kit não informado'}
                      </p>
                      {reserva.endereco_evento && (
                        <p className="text-sm text-slate-600 mt-1">
                          Local: {reserva.endereco_evento}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col md:items-end gap-2">
                      <span className="text-xs bg-pink-50 text-pink-700 rounded-full px-3 py-1 w-fit">
                        {reserva.status}
                      </span>
                      <span className="text-sm text-slate-600">
                        R$ {Number(reserva.valor_total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

        {filtradas.length === 0 && (
          <Card>
            <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
              Nenhuma reserva encontrada na agenda.
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
