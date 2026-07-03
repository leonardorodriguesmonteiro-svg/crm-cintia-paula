'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

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
      setErro(error.message.includes('duplicate') ? 'Este item já faz parte da composição deste kit.' : error.message)
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

    if (error) return setErro(error.message)
    carregarComposicao(kitId)
  }

  const kitSelecionado = kits.find(k => k.id === kitId)

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

          <Select value={kitId} onChange={(e) => setKitId(e.target.value)}>
            <option value="">Escolha um kit...</option>
            {kits.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.codigo ? `${kit.codigo} - ` : ''}{kit.nome}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {kitId && (
        <Card>
          <form onSubmit={adicionar} className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Adicionar item ao kit</h2>
              <p className="text-sm text-slate-500">
                Kit selecionado: <strong>{kitSelecionado?.nome}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select label="Item do estoque" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                <option value="">Selecione um item...</option>
                {itens.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.codigo ? `${item.codigo} - ` : ''}{item.nome} | Disp: {item.quantidade_disponivel || 0}
                  </option>
                ))}
              </Select>

              <Input
                label="Quantidade usada no kit"
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />

              <Textarea
                label="Observações"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: usar somente em festas internas"
              />
            </div>

            <Button type="submit">Adicionar item</Button>
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
          </div>

          <div className="space-y-3">
            {composicao.map((linha) => (
              <div key={linha.id} className="rounded-2xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{linha.estoque_itens?.nome}</p>
                  <p className="text-sm text-slate-500">
                    {linha.estoque_itens?.codigo || 'Sem código'} • Quantidade no kit: {linha.quantidade}
                  </p>
                  {linha.observacoes && (
                    <p className="text-sm text-slate-600 mt-1">{linha.observacoes}</p>
                  )}
                </div>

                <Button variant="danger" onClick={() => remover(linha.id)}>
                  Remover
                </Button>
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
