'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

    if (error) {
      setErro(error.message)
      return
    }

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
    if (error) {
      setErro(error.message)
      return
    }
    carregar()
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Estoque</h1>
        <p className="text-slate-500">Controle os itens físicos usados nos kits.</p>
      </div>

      <form onSubmit={salvar} className="bg-white rounded-2xl border p-5 space-y-4">
        <h2 className="text-lg font-semibold">
          {editando ? 'Editar item' : 'Novo item'}
        </h2>

        {erro && (
          <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">
            {erro}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="border rounded-lg px-3 py-2" placeholder="Código" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Nome do item *" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Categoria" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Cor" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} />
          <input className="border rounded-lg px-3 py-2" type="number" placeholder="Qtd. total" value={form.quantidade_total} onChange={e => setForm({ ...form, quantidade_total: Number(e.target.value) })} />
          <input className="border rounded-lg px-3 py-2" type="number" placeholder="Qtd. disponível" value={form.quantidade_disponivel} onChange={e => setForm({ ...form, quantidade_disponivel: Number(e.target.value) })} />
          <input className="border rounded-lg px-3 py-2" type="number" placeholder="Qtd. manutenção" value={form.quantidade_manutencao} onChange={e => setForm({ ...form, quantidade_manutencao: Number(e.target.value) })} />
          <input className="border rounded-lg px-3 py-2" type="number" placeholder="Valor reposição" value={form.valor_reposicao} onChange={e => setForm({ ...form, valor_reposicao: Number(e.target.value) })} />
          <input className="border rounded-lg px-3 py-2" placeholder="Localização" value={form.localizacao} onChange={e => setForm({ ...form, localizacao: e.target.value })} />
        </div>

        <select className="border rounded-lg px-3 py-2 w-full md:w-64" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
          <option>Disponível</option>
          <option>Reservado</option>
          <option>Manutenção</option>
          <option>Danificado</option>
          <option>Inativo</option>
        </select>

        <textarea className="border rounded-lg px-3 py-2 w-full" placeholder="Observações" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

        <div className="flex gap-2">
          <button disabled={salvando} className="bg-pink-600 text-white rounded-lg px-4 py-2">
            {salvando ? 'Salvando...' : editando ? 'Salvar edição' : 'Cadastrar item'}
          </button>
          {editando && (
            <button type="button" className="border rounded-lg px-4 py-2" onClick={() => { setEditando(null); setForm(vazio) }}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-2xl border p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Itens cadastrados</h2>
          <input className="border rounded-lg px-3 py-2" placeholder="Buscar item..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtrados.map((item) => (
            <div key={item.id} className="border rounded-xl p-4 space-y-2">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.nome}</p>
                  <p className="text-sm text-slate-500">{item.codigo || 'Sem código'} • {item.categoria || 'Sem categoria'}</p>
                </div>
                <span className="text-xs bg-pink-50 text-pink-700 rounded-full px-2 py-1 h-fit">
                  {item.status}
                </span>
              </div>

              <div className="grid grid-cols-3 text-center text-sm border rounded-lg overflow-hidden">
                <div className="p-2">
                  <p className="font-bold">{item.quantidade_total || 0}</p>
                  <p className="text-slate-500">Total</p>
                </div>
                <div className="p-2 border-x">
                  <p className="font-bold">{item.quantidade_disponivel || 0}</p>
                  <p className="text-slate-500">Disp.</p>
                </div>
                <div className="p-2">
                  <p className="font-bold">{item.quantidade_manutencao || 0}</p>
                  <p className="text-slate-500">Manut.</p>
                </div>
              </div>

              <p className="text-sm text-slate-600">Cor: {item.cor || '-'}</p>
              <p className="text-sm text-slate-600">Local: {item.localizacao || '-'}</p>

              <div className="flex gap-2 pt-2">
                <button onClick={() => editar(item)} className="border rounded-lg px-3 py-2 text-sm">
                  Editar
                </button>
                <button onClick={() => excluir(item.id)} className="border rounded-lg px-3 py-2 text-sm text-red-600">
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtrados.length === 0 && (
          <p className="text-slate-500 text-sm">Nenhum item encontrado.</p>
        )}
      </div>
    </div>
  )
}
