'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { clausulasLocacaoContrato, declaracaoAceiteContrato, termosGeraisContrato } from '@/lib/contratoTermos'

type Contrato = {
  id: string
  numero_contrato: string
  status: string | null
  observacoes: string | null
  pdf_url: string | null
  created_at: string | null
}

export function ReservaContrato({ reservaId }: { reservaId: string }) {
  const [contrato, setContrato] = useState<Contrato | null>(null)
  const [reserva, setReserva] = useState<any>(null)
  const [recebimentos, setRecebimentos] = useState<any[]>([])
  const [itensReserva, setItensReserva] = useState<any[]>([])
  const [status, setStatus] = useState('Gerado')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')

  async function carregar() {
    const contratoRes = await supabase
      .from('contratos')
      .select('id,numero_contrato,status,observacoes,pdf_url,created_at')
      .eq('reserva_id', reservaId)
      .maybeSingle()

    const reservaRes = await supabase
      .from('reservas')
      .select('*,clientes(*),kits(*)')
      .eq('id', reservaId)
      .single()

    const recebimentosRes = await supabase
      .from('recebimentos')
      .select('*')
      .eq('reserva_id', reservaId)

    const itensRes = await supabase
      .from('reserva_itens')
      .select('id,descricao,quantidade,valor_unitario,subtotal,kit_id')
      .eq('reserva_id', reservaId)
      .order('ordem', { ascending: true })

    if (contratoRes.error) return setErro(contratoRes.error.message)
    if (reservaRes.error) return setErro(reservaRes.error.message)

    setContrato(contratoRes.data)
    setReserva(reservaRes.data)
    setRecebimentos(recebimentosRes.data || [])
    setItensReserva(itensRes.data || [])
    setStatus(contratoRes.data?.status || 'Gerado')
    setObservacoes(contratoRes.data?.observacoes || '')
  }

  useEffect(() => {
    carregar()
  }, [reservaId])

  async function registrarTimeline(titulo: string, descricao: string) {
    await supabase.from('reserva_timeline').insert({
      reserva_id: reservaId,
      titulo,
      descricao,
      tipo: 'Contrato'
    })
  }

  async function gerarContrato() {
    setErro('')
    const numero = `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`

    const { error } = await supabase.from('contratos').insert({
      reserva_id: reservaId,
      numero_contrato: numero,
      status: 'Gerado',
      observacoes: 'Contrato gerado pelo Centro da Reserva.'
    })

    if (error) return setErro(error.message)

    await registrarTimeline('Contrato gerado', `Contrato ${numero} gerado.`)
    carregar()
  }

  async function salvarContrato() {
    if (!contrato) return

    const { error } = await supabase
      .from('contratos')
      .update({ status, observacoes })
      .eq('id', contrato.id)

    if (error) return setErro(error.message)

    await registrarTimeline('Contrato atualizado', `Status do contrato alterado para ${status}.`)
    carregar()
  }

  const valorTotal = Number(reserva?.valor_total || 0)
  const recebido = recebimentos.reduce((t, r) => t + Number(r.valor || 0), 0)
  const saldo = Math.max(valorTotal - recebido, 0)

  return (
    <Card>
      <h2 className="text-lg font-semibold text-slate-900">Contrato</h2>
      <p className="mt-1 text-sm text-slate-500">
        Gere, acompanhe e valide o contrato vinculado a esta reserva.
      </p>

      {erro && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}

      {!contrato ? (
        <div className="mt-6 rounded-2xl border border-dashed p-6 text-center">
          <p className="text-sm text-slate-500 mb-4">
            Nenhum contrato gerado para esta reserva.
          </p>
          <Button onClick={gerarContrato}>Gerar contrato</Button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-sm text-slate-500">Número do contrato</p>
            <p className="text-xl font-bold text-slate-900">{contrato.numero_contrato}</p>
            <p className="mt-1 text-sm text-slate-500">
              Criado em: {contrato.created_at ? new Date(contrato.created_at).toLocaleString('pt-BR') : '-'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Status" value={status} onChange={e => setStatus(e.target.value)}>
              <option>Gerado</option>
              <option>Enviado</option>
              <option>Assinado</option>
              <option>Cancelado</option>
            </Select>

            <div className="flex items-end">
              <Button onClick={salvarContrato}>Salvar contrato</Button>
            </div>
          </div>

          <Textarea
            label="Observações"
            value={observacoes}
            onChange={e => setObservacoes(e.target.value)}
            placeholder="Observações internas sobre o contrato..."
          />

          <div className="rounded-2xl border bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Prévia do contrato</h3>

            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
              <p>
                <strong>CONTRATANTE:</strong> {reserva?.clientes?.nome || 'Cliente não informado'}, 
                CPF/CNPJ {reserva?.clientes?.cpf || 'não informado'}, residente/endereço em {reserva?.clientes?.endereco || 'não informado'}.
              </p>

              <p>
                <strong>CONTRATADA:</strong> Cintia Paula Festas e Decorações.
              </p>

              <p>
                <strong>OBJETO:</strong> Locação/contratação dos kits e serviços abaixo,
                para evento a ser realizado em <strong>{reserva?.data_evento || 'data não informada'}</strong>, 
                às <strong>{reserva?.horario_evento || 'horário não informado'}</strong>, no endereço <strong>{reserva?.endereco_evento || 'não informado'}</strong>.
              </p>

              <div className="rounded-xl border bg-white p-3">
                <strong>ITENS CONTRATADOS:</strong>
                {itensReserva.map(item => <p key={item.id}>{item.quantidade} × {item.descricao} — R$ {Number(item.subtotal || 0).toFixed(2)}</p>)}
                {!itensReserva.length && <p>1 × {reserva?.kits?.nome || 'Kit não informado'}</p>}
              </div>

              <p>
                <strong>VALOR:</strong> O valor total contratado é de <strong>R$ {valorTotal.toFixed(2)}</strong>. 
                Até o momento, consta recebido o valor de <strong>R$ {recebido.toFixed(2)}</strong>, 
                restando saldo de <strong>R$ {saldo.toFixed(2)}</strong>.
              </p>

              <div><strong>TERMOS E CONDIÇÕES:</strong><ol className="list-decimal space-y-1 pl-5">{termosGeraisContrato.map(termo => <li key={termo}>{termo}</li>)}</ol></div>

              <div><strong>CLÁUSULAS PARA LOCAÇÃO:</strong><ol className="list-decimal space-y-1 pl-5">{clausulasLocacaoContrato.map(clausula => <li key={clausula.titulo}><strong>{clausula.titulo}:</strong> {clausula.texto}</li>)}</ol></div>

              <p><strong>{declaracaoAceiteContrato}</strong></p>

              <p>
                <strong>STATUS DO CONTRATO:</strong> {status}.
              </p>
            </div>
          </div>

          <a
            href={`/contratos/${contrato.id}/imprimir`}
            target="_blank"
            className="inline-flex w-fit rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700"
          >
            Abrir contrato para impressão
          </a>

          {contrato.pdf_url && (
            <a href={contrato.pdf_url} target="_blank" className="text-sm font-semibold text-pink-700">
              Abrir contrato para impressão salvo
            </a>
          )}
        </div>
      )}
    </Card>
  )
}
