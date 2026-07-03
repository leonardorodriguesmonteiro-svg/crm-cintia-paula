'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export function ReservaDetalhePage({ id }: { id: string }) {
  const [reserva, setReserva] = useState<any>(null)
  const [recebimentos, setRecebimentos] = useState<any[]>([])
  const [erro, setErro] = useState('')

  async function carregar() {
    const reservaRes = await supabase
      .from('reservas')
      .select('*,clientes(*),kits(*)')
      .eq('id', id)
      .single()

    const recebimentosRes = await supabase
      .from('recebimentos')
      .select('*')
      .eq('reserva_id', id)
      .order('created_at', { ascending: false })

    if (reservaRes.error) setErro(reservaRes.error.message)
    else setReserva(reservaRes.data)

    if (recebimentosRes.error) setErro(recebimentosRes.error.message)
    else setRecebimentos(recebimentosRes.data || [])
  }

  useEffect(() => {
    carregar()
  }, [id])

  if (erro) {
    return <div className="p-8 text-red-700">{erro}</div>
  }

  if (!reserva) {
    return <div className="p-8 text-slate-500">Carregando reserva...</div>
  }

  const valorTotal = Number(reserva.valor_total || 0)
  const recebido = recebimentos.reduce((t, r) => t + Number(r.valor || 0), 0)
  const saldo = Math.max(valorTotal - recebido, 0)

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <Link href="/reservas" className="text-sm font-semibold text-pink-700">
            ← Voltar para Reservas
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Centro da Reserva</h1>
          <p className="text-slate-500">
            {reserva.clientes?.nome || 'Cliente'} • {reserva.kits?.nome || 'Kit'}
          </p>
        </div>

        <span className="rounded-full bg-pink-50 px-4 py-2 text-sm font-semibold text-pink-700">
          {reserva.status}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Valor contratado</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">R$ {valorTotal.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Recebido</p>
          <p className="mt-2 text-3xl font-bold text-green-700">R$ {recebido.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Saldo</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">R$ {saldo.toFixed(2)}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Cliente</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p><strong>Nome:</strong> {reserva.clientes?.nome || '-'}</p>
            <p><strong>WhatsApp:</strong> {reserva.clientes?.whatsapp || '-'}</p>
            <p><strong>Instagram:</strong> {reserva.clientes?.instagram || '-'}</p>
            <p><strong>Email:</strong> {reserva.clientes?.email || '-'}</p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Evento</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p><strong>Data:</strong> {reserva.data_evento || '-'}</p>
            <p><strong>Horário:</strong> {reserva.horario_evento || '-'}</p>
            <p><strong>Endereço:</strong> {reserva.endereco_evento || '-'}</p>
            <p><strong>Observações:</strong> {reserva.observacoes || '-'}</p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Kit</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p><strong>Código:</strong> {reserva.kits?.codigo || '-'}</p>
            <p><strong>Nome:</strong> {reserva.kits?.nome || '-'}</p>
            <p><strong>Categoria:</strong> {reserva.kits?.categoria || '-'}</p>
            <p><strong>Valor:</strong> R$ {Number(reserva.kits?.valor || 0).toFixed(2)}</p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Financeiro</h2>
          <div className="mt-4 space-y-3">
            {recebimentos.map((item) => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold text-slate-900">R$ {Number(item.valor || 0).toFixed(2)}</p>
                <p className="text-slate-500">
                  {item.forma_pagamento || '-'} • {item.data_recebimento || '-'}
                </p>
              </div>
            ))}

            {recebimentos.length === 0 && (
              <p className="text-sm text-slate-500">Nenhum recebimento registrado.</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Próximas etapas</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Button variant="secondary">Contrato</Button>
          <Button variant="secondary">Checklist</Button>
          <Button variant="secondary">Entrega</Button>
          <Button variant="secondary">Devolução</Button>
        </div>
      </Card>
    </div>
  )
}
