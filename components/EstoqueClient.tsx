'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Item = {
  id: string
  codigo: string | null
  nome: string
  categoria: string | null
  cor: string | null
  quantidade_total: number | null
  quantidade_disponivel: number | null
  quantidade_manutencao: number | null
  valor_reposicao: number | null
  localizacao: string | null
  observacoes: string | null
  status: string | null
}

const vazio = {
  codigo: '',
  nome: '',
  categoria: '',
  cor: '',
  quantidade_total: 0,
  quantidade_disponivel: 0,
  quantidade_manutencao: 0,
  valor_reposicao: 0,
  localizacao: '',
  observacoes: '',
  status: 'Disponível'
}

export function EstoqueClient() {
  const [itens, setItens] = useState<Item[]>([])
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const { data, error } = await supabase
      .from('estoque_itens')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return setErro(error.message)
    setItens(data || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase()
    return itens.filter((item) =>
      [item.nome, item.codigo, item.categoria, item.cor, item.status]
        .join(' ')
        .toLowerCase()
        .includes(termo)
    )
  }, [itens, busca])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    if (!form.nome.trim()) {
      setErro('Informe o nome do item.')
      setSalvando(false)
      return
    }

    const payload = {
      ...form,
      quantidade_total: Number(form.quantidade_total) || 0,
      quantidade_disponivel: Number(form.quantidade_disponivel) || 0,
      quantidade_manutencao: Number(form.quantidade_manutencao) || 0,
      valor_reposicao: Number(form.valor_reposicao) || 0
    }

    const resposta = editando
      ? await supabase.from('estoque_itens').update(payload).eq('id', editando)
      : await supabase.from('estoque_itens').insert(payload)

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

  function editar(item: Item) {
    setEditando(item.id)
    setForm({
      codigo: item.codigo || '',
      nome: item.nome || '',
      categoria: item.categoria || '',
      cor: item.cor || '',
      quantidade_total: item.quantidade_total || 0,
      quantidade_disponivel: item.quantidade_disponivel || 0,
      quantidade_manutencao: item.quantidade_manutencao || 0,
      valor_reposicao: item.valor_reposicao || 0,
      localizacao: item.localizacao || '',
      observacoes: item.observacoes || '',
      status: item.status || 'Disponível'
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir este item do estoque?')) return
    const { error } = await supabase.from('estoque_itens').delete().eq('id', id)
    if (error) return setErro(error.message)
    carregar()
  }

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Estoque</h1>
        <p className="text-slate-500">Controle os itens físicos usados nos kits.</p>
      </div>

      <Card>
        <form onSubmit={salvar} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editando ? 'Editar item do estoque' : 'Novo item de estoque'}
            </h2>
            <p className="text-sm text-slate-500">
              Cadastre peças, painéis, cilindros, bandejas e demais itens físicos.
            </p>
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Input label="Código interno" placeholder="Ex.: EST-001" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
            <Input label="Nome do item *" placeholder="Ex.: Painel redondo Safari" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            <Input label="Categoria" placeholder="Ex.: Painéis" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
            <Input label="Cor" placeholder="Ex.: Branco" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} />
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Quantidades</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Quantidade total" type="number" value={form.quantidade_total} onChange={e => setForm({ ...form, quantidade_total: Number(e.target.value) })} />
              <Input label="Quantidade disponível" type="number" value={form.quantidade_disponivel} onChange={e => setForm({ ...form, quantidade_disponivel: Number(e.target.value) })} />
              <Input label="Quantidade em manutenção" type="number" value={form.quantidade_manutencao} onChange={e => setForm({ ...form, quantidade_manutencao: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Valor de reposição" type="number" placeholder="0,00" value={form.valor_reposicao} onChange={e => setForm({ ...form, valor_reposicao: Number(e.target.value) })} />
            <Input label="Localização" placeholder="Ex.: Depósito A" value={form.localizacao} onChange={e => setForm({ ...form, localizacao: e.target.value })} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Disponível</option>
              <option>Reservado</option>
              <option>Manutenção</option>
              <option>Danificado</option>
              <option>Inativo</option>
            </Select>
          </div>

          <Textarea label="Observações" placeholder="Detalhes importantes sobre o item..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar edição' : 'Cadastrar item'}
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
            <h2 className="text-lg font-semibold text-slate-900">Itens cadastrados</h2>
            <p className="text-sm text-slate-500">{filtrados.length} item(ns) encontrado(s)</p>
          </div>

          <Input placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((item) => (
            <div key={item.id} className="rounded-2xl border p-4 space-y-3 bg-white">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.nome}</p>
                  <p className="text-sm text-slate-500">{item.codigo || 'Sem código'} • {item.categoria || 'Sem categoria'}</p>
                </div>
                <span className="text-xs bg-pink-50 text-pink-700 rounded-full px-2 py-1 h-fit">
                  {item.status}
                </span>
              </div>

              <div className="grid grid-cols-3 text-center text-sm border rounded-xl overflow-hidden">
                <div className="p-2">
                  <p className="font-bold">{item.quantidade_total || 0}</p>
                  <p className="text-slate-500">Total</p>
                </div>
                <div className="p-2 border-x">
                  <p className="font-bold">{item.quantidade_disponivel || 0}</p>
                  <p className="text-slate-500">Disponível</p>
                </div>
                <div className="p-2">
                  <p className="font-bold">{item.quantidade_manutencao || 0}</p>
                  <p className="text-slate-500">Manut.</p>
                </div>
              </div>

              <p className="text-sm text-slate-600">Cor: {item.cor || '-'}</p>
              <p className="text-sm text-slate-600">Localização: {item.localizacao || '-'}</p>

              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => editar(item)}>Editar</Button>
                <Button variant="danger" onClick={() => excluir(item.id)}>Excluir</Button>
              </div>
            </div>
          ))}
        </div>

        {filtrados.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            Nenhum item encontrado.
          </div>
        )}
      </Card>
    </div>
  )
}
