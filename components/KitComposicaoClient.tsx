'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Kit = { id: string; nome: string; codigo: string | null }
type Item = { id: string; nome: string; codigo: string | null; quantidade_disponivel: number | null }
type Composicao = {
  id: string
  quantidade: number
  observacoes: string | null
  estoque_itens: Item | null
}

export function KitComposicaoClient() {
  const [kits, setKits] = useState<Kit[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [kitId, setKitId] = useState('')
  const [itemId, setItemId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [observacoes, setObservacoes] = useState('')
  const [composicao, setComposicao] = useState<Composicao[]>([])
  const [erro, setErro] = useState('')

  async function carregarBase() {
    const kitsRes = await supabase.from('kits').select('id,nome,codigo').order('nome')
    const itensRes = await supabase.from('estoque_itens').select('id,nome,codigo,quantidade_disponivel').order('nome')

    if (kitsRes.error) setErro(kitsRes.error.message)
    else setKits(kitsRes.data || [])

    if (itensRes.error) setErro(itensRes.error.message)
    else setItens(itensRes.data || [])
  }

  async function carregarComposicao(id: string) {
    if (!id) {
      setComposicao([])
      return
    }

    const { data, error } = await supabase
      .from('kit_composicao')
      .select('id,quantidade,observacoes,estoque_itens(id,nome,codigo,quantidade_disponivel)')
      .eq('kit_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      setErro(error.message)
      return
    }

    setComposicao((data as any) || [])
  }

  useEffect(() => {
    carregarBase()
  }, [])

  useEffect(() => {
    carregarComposicao(kitId)
  }, [kitId])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!kitId) return setErro('Selecione um kit.')
    if (!itemId) return setErro('Selecione um item do estoque.')
    if (quantidade <= 0) return setErro('A quantidade deve ser maior que zero.')

    const { error } = await supabase.from('kit_composicao').insert({
      kit_id: kitId,
      item_id: itemId,
      quantidade,
      observacoes
    })

    if (error) {
      if (error.message.includes('duplicate')) {
        setErro('Este item já faz parte da composição deste kit.')
      } else {
        setErro(error.message)
      }
      return
    }

    setItemId('')
    setQuantidade(1)
    setObservacoes('')
    carregarComposicao(kitId)
  }

  async function remover(id: string) {
    if (!confirm('Remover este item da composição do kit?')) return

    const { error } = await supabase.from('kit_composicao').delete().eq('id', id)

    if (error) {
      setErro(error.message)
      return
    }

    carregarComposicao(kitId)
  }

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Composição dos Kits</h1>
        <p className="text-slate-500">Monte cada kit usando itens cadastrados no estoque.</p>
      </div>

      {erro && (
        <div className="rounded-lg bg-red-50 text-red-700 px-4 py-2 text-sm">
          {erro}
        </div>
      )}

      <div className="bg-white rounded-2xl border p-5 space-y-4">
        <label className="block text-sm font-medium">Selecione o kit</label>
        <select
          className="border rounded-lg px-3 py-2 w-full"
          value={kitId}
          onChange={(e) => setKitId(e.target.value)}
        >
          <option value="">Escolha um kit...</option>
          {kits.map((kit) => (
            <option key={kit.id} value={kit.id}>
              {kit.codigo ? `${kit.codigo} - ` : ''}{kit.nome}
            </option>
          ))}
        </select>
      </div>

      {kitId && (
        <form onSubmit={adicionar} className="bg-white rounded-2xl border p-5 space-y-4">
          <h2 className="text-lg font-semibold">Adicionar item ao kit</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              className="border rounded-lg px-3 py-2"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Item do estoque...</option>
              {itens.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.codigo ? `${item.codigo} - ` : ''}{item.nome} | Disp: {item.quantidade_disponivel || 0}
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              className="border rounded-lg px-3 py-2"
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              placeholder="Quantidade"
            />

            <input
              className="border rounded-lg px-3 py-2"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações"
            />
          </div>

          <button className="bg-pink-600 text-white rounded-lg px-4 py-2">
            Adicionar à composição
          </button>
        </form>
      )}

      {kitId && (
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="text-lg font-semibold mb-4">Itens deste kit</h2>

          <div className="space-y-3">
            {composicao.map((linha) => (
              <div key={linha.id} className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold">{linha.estoque_itens?.nome}</p>
                  <p className="text-sm text-slate-500">
                    {linha.estoque_itens?.codigo || 'Sem código'} • Quantidade no kit: {linha.quantidade}
                  </p>
                  {linha.observacoes && (
                    <p className="text-sm text-slate-600 mt-1">{linha.observacoes}</p>
                  )}
                </div>

                <button
                  onClick={() => remover(linha.id)}
                  className="border rounded-lg px-3 py-2 text-sm text-red-600"
                >
                  Remover
                </button>
              </div>
            ))}

            {composicao.length === 0 && (
              <p className="text-sm text-slate-500">Nenhum item adicionado a este kit ainda.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
