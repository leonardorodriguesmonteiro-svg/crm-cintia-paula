'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ReservaChecklist } from '@/components/reserva/ReservaChecklist'
import { ReservaLogistica } from '@/components/reserva/ReservaLogistica'
import { ReservaContrato } from '@/components/reserva/ReservaContrato'
import { ReservaCentroOperacional } from '@/components/reserva/ReservaCentroOperacional'
import { ReservaConferencia } from '@/components/reserva/ReservaConferencia'
import { useAcesso } from '@/components/auth/AcessoContext'

const abas = ['Resumo', 'Operação', 'Conferência', 'Timeline', 'Financeiro', 'Kit', 'Checklist', 'Logística', 'Contrato']

function dataCurta(valor: string | null | undefined) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export function ReservaDetalhePage({ id }: { id: string }) {
  const { acesso } = useAcesso()
  const [aba, setAba] = useState('Resumo')
  const [reserva, setReserva] = useState<any>(null)
  const [recebimentos, setRecebimentos] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [composicao, setComposicao] = useState<any[]>([])
  const [itensReserva, setItensReserva] = useState<any[]>([])
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [valorRecebido, setValorRecebido] = useState(0)
  const [formaPagamento, setFormaPagamento] = useState('Pix')

  const [form, setForm] = useState({
    data_evento: '',
    horario_evento: '',
    endereco_evento: '',
    status: 'Pendente',
    observacoes: ''
  })

  async function registrarTimeline(titulo: string, descricao = '', tipo = 'Sistema') {
    await supabase.from('reserva_timeline').insert({
      reserva_id: id,
      titulo,
      descricao,
      tipo
    })
  }

  async function carregar() {
    const reservaRes = await supabase.from('reservas').select('*,clientes(*),kits(*)').eq('id', id).single()
    const recebimentosRes = await supabase.from('recebimentos').select('*').eq('reserva_id', id).order('created_at', { ascending: false })
    const timelineRes = await supabase.from('reserva_timeline').select('*').eq('reserva_id', id).order('created_at', { ascending: false })
    const itensRes = await supabase
      .from('reserva_itens')
      .select('id,kit_id,descricao,quantidade,valor_unitario,subtotal,kits(id,nome,codigo)')
      .eq('reserva_id', id)
      .order('ordem', { ascending: true })

    if (reservaRes.error) return setErro(reservaRes.error.message)

    setReserva(reservaRes.data)
    setForm({
      data_evento: reservaRes.data.data_evento || '',
      horario_evento: reservaRes.data.horario_evento || '',
      endereco_evento: reservaRes.data.endereco_evento || '',
      status: reservaRes.data.status || 'Pendente',
      observacoes: reservaRes.data.observacoes || ''
    })

    if (!recebimentosRes.error) setRecebimentos(recebimentosRes.data || [])
    if (!timelineRes.error) setTimeline(timelineRes.data || [])
    if (!itensRes.error) setItensReserva(itensRes.data || [])

    const kitIds = Array.from(new Set(
      (itensRes.data || []).map(item => item.kit_id).filter(Boolean)
    )) as string[]
    if (!kitIds.length && reservaRes.data.kit_id) kitIds.push(reservaRes.data.kit_id)

    if (kitIds.length) {
      const compRes = await supabase
        .from('kit_composicao')
        .select('kit_id,quantidade,valor_ajuste,observacoes,kits(nome),estoque_itens(nome,codigo,categoria,quantidade_disponivel)')
        .in('kit_id', kitIds)

      if (!compRes.error) setComposicao(compRes.data || [])
    } else {
      setComposicao([])
    }
  }

  useEffect(() => {
    carregar()
  }, [id])

  if (erro) return <div className="p-8 text-red-700">{erro}</div>
  if (!reserva) return <div className="p-8 text-slate-500">Carregando reserva...</div>

  const valorTotal = Number(reserva.valor_total || 0)
  const recebido = recebimentos.reduce((t, r) => t + Number(r.valor || 0), 0)
  const saldo = Math.max(valorTotal - recebido, 0)
  const nomesKits = itensReserva.filter(item => item.kit_id).map(item => item.kits?.nome || item.descricao)
  const podeGerenciarReserva = acesso?.perfil === 'Administrador' || acesso?.perfil === 'Comercial'
  const podeRegistrarRecebimento = podeGerenciarReserva || acesso?.perfil === 'Financeiro'
  const abasPorPerfil: Record<string, string[]> = {
    Administrador: abas,
    Comercial: ['Resumo', 'Timeline', 'Financeiro', 'Kit', 'Contrato'],
    Financeiro: ['Resumo', 'Timeline', 'Financeiro', 'Contrato'],
    'Operação': ['Resumo', 'Operação', 'Conferência', 'Timeline', 'Kit', 'Checklist', 'Logística'],
    Estoque: ['Resumo', 'Conferência', 'Timeline', 'Kit', 'Checklist']
  }
  const abasVisiveis = abasPorPerfil[acesso?.perfil || ''] || ['Resumo']

  async function salvarEdicao(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    const statusAnterior = reserva.status

    const { error } = await supabase.from('reservas').update(form).eq('id', id)

    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }

    await registrarTimeline(
      'Reserva editada',
      statusAnterior !== form.status ? `Status alterado de ${statusAnterior} para ${form.status}.` : 'Dados da reserva atualizados.',
      'Edição'
    )

    setEditando(false)
    setSalvando(false)
    carregar()
  }

  async function registrarRecebimento(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    if (valorRecebido <= 0) {
      setErro('Informe um valor recebido maior que zero.')
      setSalvando(false)
      return
    }

    if (valorRecebido > saldo) {
      setErro('O valor recebido não pode ser maior que o saldo da reserva.')
      setSalvando(false)
      return
    }

    const { error } = await supabase.from('recebimentos').insert({
      reserva_id: id,
      valor: valorRecebido,
      data_recebimento: new Date().toISOString().slice(0, 10),
      forma_pagamento: formaPagamento,
      status: 'Pago',
      observacoes: 'Recebimento registrado pelo Centro da Reserva.'
    })

    if (error) {
      setErro(error.message)
      setSalvando(false)
      return
    }

    await registrarTimeline(
      'Recebimento registrado',
      `Recebimento de ${moeda(valorRecebido)} via ${formaPagamento}.`,
      'Financeiro'
    )

    setValorRecebido(0)
    setFormaPagamento('Pix')
    setSalvando(false)
    carregar()
  }

  async function confirmarReserva() {
    if (!confirm('Confirmar esta reserva e iniciar automaticamente contrato e Ordem de Serviço?')) return

    setErro('')
    setConfirmando(true)

    try {
      const { data: sessao, error: erroSessao } = await supabase.auth.getSession()
      const token = sessao.session?.access_token

      if (erroSessao || !token) {
        throw new Error('Sua sessão expirou. Entre novamente para confirmar a reserva.')
      }

      const resposta = await fetch(`/api/reservas/${id}/confirmar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })

      const resultado = await resposta.json()

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.erro || 'Não foi possível confirmar a reserva.')
      }

      await carregar()
      setAba('Operação')
      let mensagem = 'Reserva confirmada. Contrato e Ordem de Serviço processados automaticamente.'

      if (resultado.email?.enviado) {
        mensagem += resultado.email.ignorado
          ? ` O e-mail do contrato já havia sido enviado${resultado.email.destino ? ` para ${resultado.email.destino}` : ''}.`
          : ` E-mail de boas-vindas e contrato enviado${resultado.email.destino ? ` para ${resultado.email.destino}` : ''}.`
      } else {
        mensagem += ` O envio do e-mail ficou pendente${resultado.email?.erro ? `: ${resultado.email.erro}` : '.'}`
      }

      alert(mensagem)
    } catch (error: any) {
      setErro(error.message || 'Erro ao confirmar reserva.')
    } finally {
      setConfirmando(false)
    }
  }

  const whatsapp = reserva.clientes?.whatsapp
    ? `https://wa.me/55${String(reserva.clientes.whatsapp).replace(/\D/g, '')}`
    : null

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <Link href="/reservas" className="text-sm font-semibold text-pink-700">← Voltar para Reservas</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Centro da Reserva</h1>
          <p className="text-slate-500">{reserva.clientes?.nome || 'Cliente'} • {nomesKits.join(' + ') || reserva.kits?.nome || 'Kit'}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {podeGerenciarReserva && ['Pendente', 'Orçamento'].includes(reserva.status) && (
            <Button onClick={confirmarReserva} disabled={confirmando}>
              {confirmando ? 'Confirmando...' : 'Confirmar reserva'}
            </Button>
          )}

          {whatsapp && (
            <a href={whatsapp} target="_blank" rel="noreferrer">
              <Button variant="secondary">WhatsApp</Button>
            </a>
          )}

          {podeGerenciarReserva && <Button variant="secondary" onClick={() => setEditando(!editando)}>
            {editando ? 'Cancelar edição' : 'Editar reserva'}
          </Button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-slate-500">Valor contratado</p><p className="mt-2 text-3xl font-bold">{moeda(valorTotal)}</p></Card>
        <Card><p className="text-sm text-slate-500">Recebido</p><p className="mt-2 text-3xl font-bold text-green-700">{moeda(recebido)}</p></Card>
        <Card><p className="text-sm text-slate-500">Saldo</p><p className="mt-2 text-3xl font-bold text-yellow-700">{moeda(saldo)}</p></Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2">
          {abasVisiveis.map(item => (
            <button
              key={item}
              onClick={() => setAba(item)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${aba === item ? 'bg-pink-600 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {editando && (
        <Card>
          <form onSubmit={salvarEdicao} className="space-y-4">
            <h2 className="text-lg font-semibold">Editar dados da reserva</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Data do evento" type="date" value={form.data_evento} onChange={e => setForm({ ...form, data_evento: e.target.value })} />
              <Input label="Horário" value={form.horario_evento} onChange={e => setForm({ ...form, horario_evento: e.target.value })} />
              <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option>Pendente</option><option>Confirmada</option><option>Em andamento</option><option>Concluída</option><option>Cancelada</option>
              </Select>
            </div>
            <Input label="Endereço do evento" value={form.endereco_evento} onChange={e => setForm({ ...form, endereco_evento: e.target.value })} />
            <Textarea label="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar alterações'}</Button>
          </form>
        </Card>
      )}

      {aba === 'Resumo' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card><h2 className="text-lg font-semibold">Cliente</h2><div className="mt-4 space-y-2 text-sm text-slate-600"><p><strong>Nome:</strong> {reserva.clientes?.nome || '-'}</p><p><strong>WhatsApp:</strong> {reserva.clientes?.whatsapp || '-'}</p><p><strong>Instagram:</strong> {reserva.clientes?.instagram || '-'}</p><p><strong>Email:</strong> {reserva.clientes?.email || '-'}</p><p><strong>CPF:</strong> {reserva.clientes?.cpf || '-'} • <strong>RG:</strong> {reserva.clientes?.rg || '-'}</p><p><strong>Endereço:</strong> {[reserva.clientes?.endereco, reserva.clientes?.numero, reserva.clientes?.complemento, reserva.clientes?.bairro, reserva.clientes?.cidade, reserva.clientes?.estado].filter(Boolean).join(', ') || '-'}</p>{reserva.clientes?.observacoes && <p><strong>Observações:</strong> {reserva.clientes.observacoes}</p>}</div></Card>
          <Card><h2 className="text-lg font-semibold">Evento</h2><div className="mt-4 space-y-2 text-sm text-slate-600"><p><strong>Data:</strong> {dataCurta(reserva.data_evento)}</p><p><strong>Horário:</strong> {reserva.horario_evento || '-'}</p><p><strong>Status:</strong> {reserva.status || '-'}</p><p><strong>Endereço:</strong> {reserva.endereco_evento || '-'}</p><p><strong>Observações:</strong> {reserva.observacoes || '-'}</p></div></Card>
        </div>
      )}

      {aba === 'Operação' && <ReservaCentroOperacional reservaId={id} />}

      {aba === 'Conferência' && <ReservaConferencia reservaId={id} onAtualizar={carregar} />}

      {aba === 'Timeline' && (
        <Card>
          <h2 className="text-lg font-semibold">Timeline da Reserva</h2>
          <div className="mt-4 space-y-3">
            {timeline.map(item => (
              <div key={item.id} className="rounded-2xl border p-4">
                <p className="font-semibold">{item.titulo}</p>
                <p className="text-sm text-slate-500">{new Date(item.created_at).toLocaleString('pt-BR')} • {item.tipo}</p>
                {item.descricao && <p className="mt-1 text-sm text-slate-600">{item.descricao}</p>}
              </div>
            ))}
            {timeline.length === 0 && <p className="text-sm text-slate-500">Nenhum evento registrado ainda.</p>}
          </div>
        </Card>
      )}

      {aba === 'Financeiro' && (
        <Card>
          <h2 className="text-lg font-semibold">Financeiro</h2>
          {podeRegistrarRecebimento ? <form onSubmit={registrarRecebimento} className="mt-4 space-y-4 rounded-2xl border bg-slate-50 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Valor recebido" type="number" value={valorRecebido} onChange={e => setValorRecebido(Number(e.target.value))} />
              <Select label="Forma de pagamento" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
                <option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>Transferência</option><option>Boleto</option>
              </Select>
            </div>
            <Button type="submit" disabled={salvando || saldo <= 0}>{salvando ? 'Registrando...' : saldo <= 0 ? 'Reserva quitada' : 'Registrar recebimento'}</Button>
          </form> : <p className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Consulta financeira disponível. O registro de recebimentos é realizado pelo Comercial ou Financeiro.</p>}

          <div className="mt-4 space-y-3">
            {recebimentos.map(item => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{moeda(Number(item.valor || 0))}</p>
                <p className="text-slate-500">{item.forma_pagamento || '-'} • {item.data_recebimento || '-'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {aba === 'Kit' && (
        <Card>
          <h2 className="text-lg font-semibold">Kit e composição</h2>
          <div className="mt-4 space-y-2">
            {itensReserva.map(item => (
              <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl border p-3 text-sm sm:flex-row sm:items-center">
                <div><p className="font-semibold">{item.descricao}</p><p className="text-slate-500">{item.quantidade} × {moeda(Number(item.valor_unitario || 0))}</p></div>
                <strong className={Number(item.subtotal || 0) < 0 ? 'text-amber-700' : 'text-slate-900'}>{moeda(Number(item.subtotal || 0))}</strong>
              </div>
            ))}
          </div>
          <h3 className="mt-6 font-semibold text-slate-900">Composição física dos kits</h3>
          <div className="mt-4 space-y-2">
            {composicao.map((item, index) => (
              <div key={index} className="rounded-xl border p-3 text-sm">
                <p className="font-semibold">{item.estoque_itens?.nome || 'Item'} <span className="font-normal text-slate-400">· {item.kits?.nome || 'Kit'}</span></p>
                <p className="text-slate-500">Quantidade no kit: {item.quantidade} • Disponível: {item.estoque_itens?.quantidade_disponivel ?? 0}</p>
                <p className={`mt-1 font-medium ${Number(item.valor_ajuste || 0) < 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  Ajuste no valor: {Number(item.valor_ajuste || 0) > 0 ? '+' : ''}{moeda(Number(item.valor_ajuste || 0))}
                </p>
              </div>
            ))}
            {composicao.length === 0 && <p className="text-sm text-slate-500">Este kit ainda não possui composição cadastrada.</p>}
          </div>
        </Card>
      )}

      {aba === 'Checklist' && <ReservaChecklist reservaId={id} />}

      {aba === 'Logística' && <ReservaLogistica reservaId={id} />}

      {aba === 'Contrato' && <ReservaContrato reservaId={id} somenteLeitura={acesso?.perfil === 'Financeiro'} />}
    </div>
  )
}
