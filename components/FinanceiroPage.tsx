'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Lancamento = {
  id: string
  reserva_id: string | null
  tipo: 'Receita' | 'Despesa'
  descricao: string
  categoria: string | null
  valor: number
  data_vencimento: string | null
  data_pagamento: string | null
  forma_pagamento: string | null
  status: 'Pendente' | 'Pago' | 'Cancelado'
  observacoes: string | null
}

const vazio = {
  reserva_id: '',
  tipo: 'Receita',
  descricao: '',
  categoria: '',
  valor: 0,
  data_vencimento: '',
  data_pagamento: '',
  forma_pagamento: '',
  status: 'Pendente',
  observacoes: ''
}

export function FinanceiroPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const { data, error } = await supabase
      .from('lancamentos_financeiros')
      .select('*')
      .order('data_vencimento', { ascending: true })

    if (error) return setErro(error.message)
    setLancamentos((data as any) || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return lancamentos.filter((item) =>
      [
        item.tipo,
        item.descricao,
        item.categoria,
        item.status,
        item.forma_pagamento,
        item.data_vencimento
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termo)
    )
  }, [lancamentos, busca])

  const receitasPagas = lancamentos
    .filter(l => l.tipo === 'Receita' && l.status === 'Pago')
    .reduce((t, l) => t + Number(l.valor || 0), 0)

  const receitasPendentes = lancamentos
    .filter(l => l.tipo === 'Receita' && l.status === 'Pendente')
    .reduce((t, l) => t + Number(l.valor || 0), 0)

  const despesasPagas = lancamentos
    .filter(l => l.tipo === 'Despesa' && l.status === 'Pago')
    .reduce((t, l) => t + Number(l.valor || 0), 0)

  const despesasPendentes = lancamentos
    .filter(l => l.tipo === 'Despesa' && l.status === 'Pendente')
    .reduce((t, l) => t + Number(l.valor || 0), 0)

  const saldoReal = receitasPagas - despesasPagas
  const saldoPrevisto = (receitasPagas + receitasPendentes) - (despesasPagas + despesasPendentes)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    if (!form.descricao.trim()) {
      setErro('Informe a descrição do lançamento.')
      setSalvando(false)
      return
    }

    if (Number(form.valor) <= 0) {
      setErro('Informe um valor maior que zero.')
      setSalvando(false)
      return
    }

    const payload = {
      reserva_id: form.reserva_id || null,
      tipo: form.tipo,
      descricao: form.descricao,
      categoria: form.categoria || null,
      valor: Number(form.valor) || 0,
      data_vencimento: form.data_vencimento || null,
      data_pagamento: form.data_pagamento || null,
      forma_pagamento: form.forma_pagamento || null,
      status: form.status,
      observacoes: form.observacoes || null
    }

    const resposta = editando
      ? await supabase.from('lancamentos_financeiros').update(payload).eq('id', editando)
      : await supabase.from('lancamentos_financeiros').insert(payload)

    if (resposta.error) {
      setErro(resposta.error.message)
      setSalvando(false)
      return
    }

    setForm(vazio)
    setEditando(null)
    setSalvando(false)
    carregar()
  }

  function editar(item: Lancamento) {
    setEditando(item.id)
    setForm({
      reserva_id: item.reserva_id || '',
      tipo: item.tipo || 'Receita',
      descricao: item.descricao || '',
      categoria: item.categoria || '',
      valor: Number(item.valor || 0),
      data_vencimento: item.data_vencimento || '',
      data_pagamento: item.data_pagamento || '',
      forma_pagamento: item.forma_pagamento || '',
      status: item.status || 'Pendente',
      observacoes: item.observacoes || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function marcarComoPago(item: Lancamento) {
    const forma = prompt('Forma de pagamento:', item.forma_pagamento || 'Pix')
    if (!forma) return

    const hoje = new Date().toISOString().slice(0, 10)

    const { error } = await supabase
      .from('lancamentos_financeiros')
      .update({
        status: 'Pago',
        data_pagamento: hoje,
        forma_pagamento: forma
      })
      .eq('id', item.id)

    if (error) return setErro(error.message)
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este lançamento financeiro?')) return
    const { error } = await supabase.from('lancamentos_financeiros').delete().eq('id', id)
    if (error) return setErro(error.message)
    carregar()
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Financeiro</h1>
        <p className="text-slate-500">Controle receitas, despesas, recebimentos e fluxo de caixa.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-500">Receitas pagas</p>
          <p className="mt-2 text-3xl font-bold text-green-700">R$ {receitasPagas.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Receitas pendentes</p>
          <p className="mt-2 text-3xl font-bold text-yellow-700">R$ {receitasPendentes.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Despesas pagas</p>
          <p className="mt-2 text-3xl font-bold text-red-700">R$ {despesasPagas.toFixed(2)}</p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Saldo previsto</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">R$ {saldoPrevisto.toFixed(2)}</p>
        </Card>
      </div>

      <Card>
        <form onSubmit={salvar} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editando ? 'Editar lançamento' : 'Novo lançamento financeiro'}
            </h2>
            <p className="text-sm text-slate-500">Cadastre receitas e despesas da operação.</p>
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select label="Tipo" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option>Receita</option>
              <option>Despesa</option>
            </Select>

            <Input label="Descrição *" placeholder="Ex.: Sinal reserva Safari" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />

            <Input label="Categoria" placeholder="Ex.: Reserva, Compra, Manutenção" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />

            <Input label="Valor *" type="number" value={form.valor} onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input label="Vencimento" type="date" value={form.data_vencimento} onChange={e => setForm({ ...form, data_vencimento: e.target.value })} />

            <Input label="Data de pagamento" type="date" value={form.data_pagamento} onChange={e => setForm({ ...form, data_pagamento: e.target.value })} />

            <Select label="Forma de pagamento" value={form.forma_pagamento} onChange={e => setForm({ ...form, forma_pagamento: e.target.value })}>
              <option value="">Selecione...</option>
              <option>Pix</option>
              <option>Cartão</option>
              <option>Dinheiro</option>
              <option>Transferência</option>
              <option>Boleto</option>
            </Select>

            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Pendente</option>
              <option>Pago</option>
              <option>Cancelado</option>
            </Select>
          </div>

          <Textarea label="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar edição' : 'Cadastrar lançamento'}
            </Button>

            {editando && (
              <Button variant="secondary" onClick={() => { setEditando(null); setForm(vazio) }}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lançamentos</h2>
            <p className="text-sm text-slate-500">{filtrados.length} lançamento(s) encontrado(s)</p>
          </div>

          <Input placeholder="Buscar lançamento..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filtrados.map(item => (
            <div key={item.id} className="rounded-2xl border p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{item.descricao}</p>
                <p className="text-sm text-slate-500">
                  {item.tipo} • {item.categoria || 'Sem categoria'} • Venc.: {item.data_vencimento || '-'}
                </p>
                <p className="text-sm text-slate-600">
                  Forma: {item.forma_pagamento || '-'} • Pago em: {item.data_pagamento || '-'}
                </p>
              </div>

              <div className="flex flex-col md:items-end gap-2">
                <p className={`font-bold ${item.tipo === 'Receita' ? 'text-green-700' : 'text-red-700'}`}>
                  {item.tipo === 'Receita' ? '+' : '-'} R$ {Number(item.valor || 0).toFixed(2)}
                </p>

                <span className="text-xs bg-pink-50 text-pink-700 rounded-full px-3 py-1 w-fit">
                  {item.status}
                </span>

                <div className="flex gap-2">
                  {item.status === 'Pendente' && (
                    <Button onClick={() => marcarComoPago(item)}>Receber</Button>
                  )}
                  <Button variant="secondary" onClick={() => editar(item)}>Editar</Button>
                  <Button variant="danger" onClick={() => excluir(item.id)}>Excluir</Button>
                </div>
              </div>
            </div>
          ))}

          {filtrados.length === 0 && (
            <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
              Nenhum lançamento financeiro encontrado.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
