'use client'

import { useEffect, useMemo, useState } from 'react'
import { correspondeBusca } from '@/lib/catalogoBusca'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type Kit = { id: string; nome: string; codigo: string | null; valor: number | null }
type Item = { id: string; nome: string; codigo: string | null; quantidade_disponivel: number | null }
type Composicao = {
  id: string
  item_id: string
  quantidade: number
  valor_ajuste: number
  observacoes: string | null
  estoque_itens: Item | null
}

export function KitComposicaoClient() {
  const [kits, setKits] = useState<Kit[]>([])
  const [itens, setItens] = useState<Item[]>([])
  const [kitId, setKitId] = useState('')
  const [itemId, setItemId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [valorAjuste, setValorAjuste] = useState(0)
  const [observacoes, setObservacoes] = useState('')
  const [composicao, setComposicao] = useState<Composicao[]>([])
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [buscaItem, setBuscaItem] = useState('')
  const [buscaKit, setBuscaKit] = useState('')
  const kitsFiltrados = useMemo(() => kits.filter(kit => correspondeBusca(buscaKit, [kit.nome, kit.codigo])).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true })), [kits, buscaKit])

  function moeda(valor: number) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
  }

  async function carregarBase() {
    const kitsRes = await supabase.from('kits').select('id,nome,codigo,valor').order('nome')
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
      .select('id,item_id,quantidade,valor_ajuste,observacoes,estoque_itens(id,nome,codigo,quantidade_disponivel)')
      .eq('kit_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      setErro(error.message)
      return
    }

    const linhas = ((data as any) || []) as Composicao[]
    setComposicao(linhas.sort((a, b) =>
      (a.estoque_itens?.nome || '').localeCompare(b.estoque_itens?.nome || '', 'pt-BR')
    ))
  }

  useEffect(() => {
    carregarBase()
  }, [])

  useEffect(() => {
    carregarComposicao(kitId)
    cancelarEdicao()
  }, [kitId])

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!kitId) return setErro('Selecione um kit.')
    if (!itemId) return setErro('Selecione um item do estoque.')
    if (quantidade <= 0) return setErro('A quantidade deve ser maior que zero.')

    const itemSelecionado = itens.find(item => item.id === itemId)
    if (quantidade > Number(itemSelecionado?.quantidade_disponivel || 0)) {
      return setErro(`Há somente ${itemSelecionado?.quantidade_disponivel || 0} unidade(s) disponíveis deste item.`)
    }

    const payload = {
      kit_id: kitId,
      item_id: itemId,
      quantidade,
      valor_ajuste: Number(valorAjuste) || 0,
      observacoes: observacoes || null
    }

    const { error } = editando
      ? await supabase.from('kit_composicao').update(payload).eq('id', editando)
      : await supabase.from('kit_composicao').insert(payload)

    if (error) {
      setErro(error.message.includes('duplicate') ? 'Este item já faz parte da composição deste kit.' : error.message)
      return
    }

    setItemId('')
    setQuantidade(1)
    setValorAjuste(0)
    setObservacoes('')
    setEditando(null)
    setBuscaItem('')
    carregarComposicao(kitId)
  }

  function editar(linha: Composicao) {
    setEditando(linha.id)
    setItemId(linha.item_id)
    setQuantidade(linha.quantidade)
    setValorAjuste(Number(linha.valor_ajuste || 0))
    setObservacoes(linha.observacoes || '')
    setErro('')
  }

  function cancelarEdicao() {
    setEditando(null)
    setItemId('')
    setQuantidade(1)
    setValorAjuste(0)
    setObservacoes('')
    setBuscaItem('')
  }

  async function remover(id: string) {
    if (!confirm('Remover este item da composição do kit?')) return
    const { error } = await supabase.from('kit_composicao').delete().eq('id', id)

    if (error) return setErro(error.message)
    carregarComposicao(kitId)
  }

  const kitSelecionado = kits.find(k => k.id === kitId)
  const valorBase = Number(kitSelecionado?.valor || 0)
  const totalAjustes = composicao.reduce((total, linha) => total + Number(linha.valor_ajuste || 0), 0)
  const valorCalculado = Math.max(valorBase + totalAjustes, 0)
  const itensDisponiveis = useMemo(() => {
    const vinculados = new Set(composicao.filter(linha => linha.id !== editando).map(linha => linha.item_id))

    return itens.filter(item => {
      if (vinculados.has(item.id)) return false
      return correspondeBusca(buscaItem, [item.codigo, item.nome])
    })
  }, [buscaItem, composicao, editando, itens])

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Composição dos Kits</h1>
        <p className="text-slate-500">Monte cada kit com os itens cadastrados no estoque.</p>
      </div>

      {erro && (
        <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Selecionar kit</h2>
            <p className="text-sm text-slate-500">Escolha qual kit deseja montar ou revisar.</p>
          </div>

          <Input label="Buscar kit para compor" placeholder="Digite o nome ou código..." value={buscaKit} onChange={e => setBuscaKit(e.target.value)} />
          <p className="text-sm text-slate-500" role="status">{kitsFiltrados.length} de {kits.length} kit(s)</p>
          <div className="max-h-64 overflow-y-auto rounded-xl border [scrollbar-width:auto] [&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400" role="group" aria-label="Kits para compor">
            {kitsFiltrados.map(kit => (
              <button key={kit.id} type="button" aria-pressed={kitId === kit.id} onClick={() => setKitId(kit.id)} className={`block min-h-11 w-full border-b px-3 py-2 text-left text-sm last:border-0 focus-visible:outline-pink-600 ${kitId === kit.id ? 'bg-pink-50 font-semibold text-pink-800' : 'hover:bg-slate-50'}`}>
                {kit.codigo ? `${kit.codigo} · ` : ''}{kit.nome}
              </button>
            ))}
            {!kitsFiltrados.length && <p className="p-3 text-sm text-slate-500">Nenhum kit encontrado. Tente outro nome ou código.</p>}
          </div>
          {buscaKit && <Button variant="secondary" onClick={() => setBuscaKit('')}>Limpar busca de kits</Button>}
          {kitSelecionado && <p className="text-sm text-pink-800">Kit selecionado: <strong>{kitSelecionado.nome}</strong></p>}
        </div>
      </Card>

      {kitId && (
        <Card>
          <form onSubmit={adicionar} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {editando ? 'Editar item da composição' : 'Adicionar item ao kit'}
              </h2>
              <p className="text-sm text-slate-500">
                Kit selecionado: <strong>{kitSelecionado?.nome}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,3fr)_140px_minmax(180px,1fr)]">
              <div className="space-y-2">
                <Input
                  label="Buscar item do estoque"
                  placeholder="Digite o nome ou código..."
                  value={buscaItem}
                  onChange={(e) => setBuscaItem(e.target.value)}
                />
                <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border bg-white p-2 [scrollbar-width:auto] [&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-track]:bg-slate-100">
                  {itensDisponiveis.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setItemId(item.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${itemId === item.id ? 'bg-pink-100 text-pink-900' : 'hover:bg-slate-50'}`}
                    >
                      <span><strong>{item.nome}</strong>{item.codigo ? ` · ${item.codigo}` : ''}</span>
                      <span className="text-xs text-slate-500">Disp.: {item.quantidade_disponivel || 0}</span>
                    </button>
                  ))}
                  {itensDisponiveis.length === 0 && (
                    <p className="px-3 py-4 text-center text-sm text-slate-500">Nenhum item disponível para este filtro.</p>
                  )}
                </div>
              </div>

              <Input
                label="Quantidade usada no kit"
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />

              <Input
                label="Ajuste no preço (R$)"
                type="number"
                step="0.01"
                value={valorAjuste}
                onChange={(e) => setValorAjuste(Number(e.target.value))}
                placeholder="Use negativo para reduzir"
              />

              <Textarea
                className="md:col-span-3"
                label="Observações"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: usar somente em festas internas"
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">{editando ? 'Salvar composição' : 'Adicionar item'}</Button>
              {editando && <Button variant="secondary" onClick={cancelarEdicao}>Cancelar</Button>}
            </div>
          </form>
        </Card>
      )}

      {kitId && (
        <Card>
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Itens deste kit</h2>
            <p className="text-sm text-slate-500">
              {composicao.length} item(ns) vinculados à composição.
            </p>
            <div className="mt-3 grid gap-2 rounded-2xl bg-pink-50 p-4 text-sm text-pink-900 sm:grid-cols-3">
              <p>Valor base: <strong>{moeda(valorBase)}</strong></p>
              <p>Ajustes da composição: <strong>{moeda(totalAjustes)}</strong></p>
              <p>Valor sugerido: <strong>{moeda(valorCalculado)}</strong></p>
            </div>
          </div>

          <div className="space-y-3">
            {composicao.map((linha) => (
              <div key={linha.id} className="rounded-2xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{linha.estoque_itens?.nome}</p>
                  <p className="text-sm text-slate-500">
                    {linha.estoque_itens?.codigo || 'Sem código'} • Quantidade no kit: {linha.quantidade}
                  </p>
                  <p className={`text-sm font-medium ${Number(linha.valor_ajuste || 0) < 0 ? 'text-amber-700' : 'text-green-700'}`}>
                    Ajuste no preço: {Number(linha.valor_ajuste || 0) > 0 ? '+' : ''}{moeda(Number(linha.valor_ajuste || 0))}
                  </p>
                  {linha.observacoes && (
                    <p className="text-sm text-slate-600 mt-1">{linha.observacoes}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => editar(linha)}>Editar</Button>
                  <Button variant="danger" onClick={() => remover(linha.id)}>Remover</Button>
                </div>
              </div>
            ))}

            {composicao.length === 0 && (
              <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
                Nenhum item adicionado a este kit ainda.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
