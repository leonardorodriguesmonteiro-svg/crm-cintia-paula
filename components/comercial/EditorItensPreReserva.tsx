'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { calcularAjusteComercial, type TipoDescontoPreReserva } from '@/lib/domain/comercial/jornadaComercial'

type Item = {
  id?: string
  tipo: 'KIT' | 'ITEM_ESTOQUE'
  kit_id?: string | null
  estoque_item_id?: string | null
  nome_snapshot: string
  quantidade: number
  valor_referencia: number | null
  observacoes: string | null
}
type Pedido = {
  id: string
  versao: number
  desconto_tipo: TipoDescontoPreReserva
  desconto_valor: number
  oportunidade_itens: Item[]
}
type Linha = Omit<Item, 'quantidade' | 'valor_referencia'> & { chave: string; quantidade: string; valor_referencia: string }
type Catalogo = { id: string; nome: string; tipo: Item['tipo']; valor: number | null }
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function EditorItensPreReserva({ pedido, onSaved }: { pedido: Pedido; onSaved: () => Promise<void> }) {
  const [versao] = useState(pedido.versao)
  const [linhas, setLinhas] = useState<Linha[]>(() => pedido.oportunidade_itens.map((item, indice) => ({
    ...item, chave: item.id || String(indice), quantidade: String(item.quantidade),
    valor_referencia: item.valor_referencia === null ? '' : String(item.valor_referencia)
  })))
  const [tipo, setTipo] = useState(pedido.desconto_tipo || 'VALOR')
  const [desconto, setDesconto] = useState(String(pedido.desconto_valor || 0))
  const [catalogo, setCatalogo] = useState<Catalogo[]>([])
  const [selecionado, setSelecionado] = useState('')
  const [erro, setErro] = useState('')
  const [erroCatalogo, setErroCatalogo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      const [kits, estoque] = await Promise.all([
        supabase.from('kits').select('id,nome,valor').neq('status', 'Inativo').order('nome'),
        supabase.from('estoque_itens').select('id,nome,valor_locacao').neq('status', 'Inativo').order('nome')
      ])
      if (!ativo) return
      if (kits.error || estoque.error) setErroCatalogo('Não foi possível carregar o catálogo. Você ainda pode editar os itens existentes.')
      setCatalogo([
        ...(kits.data || []).map(item => ({ id: item.id, nome: item.nome, tipo: 'KIT' as const, valor: item.valor })),
        ...(estoque.data || []).map(item => ({ id: item.id, nome: item.nome, tipo: 'ITEM_ESTOQUE' as const, valor: item.valor_locacao }))
      ])
    }
    void carregar().catch(() => { if (ativo) setErroCatalogo('Não foi possível carregar o catálogo.') })
    return () => { ativo = false }
  }, [])

  const subtotal = Math.round(linhas.reduce((soma, linha) => soma + Number(linha.quantidade) * Number(linha.valor_referencia), 0) * 100) / 100
  const resumo = calcularAjusteComercial({ subtotal, tipo, valor: Number(desconto) })
  const linhasValidas = linhas.length > 0 && linhas.length <= 100 && linhas.every(linha =>
    linha.nome_snapshot.trim().length >= 2 && linha.nome_snapshot.trim().length <= 300 &&
    linha.quantidade.trim() !== '' && Number.isFinite(Number(linha.quantidade)) && Number(linha.quantidade) > 0 &&
    linha.valor_referencia.trim() !== '' && Number.isFinite(Number(linha.valor_referencia)) && Number(linha.valor_referencia) >= 0
  )
  function atualizar(chave: string, dados: Partial<Linha>) {
    setLinhas(atuais => atuais.map(linha => linha.chave === chave ? { ...linha, ...dados } : linha))
    setSucesso('')
  }
  function adicionar() {
    const produto = catalogo.find(item => `${item.tipo}:${item.id}` === selecionado)
    if (!produto) return
    setLinhas(atuais => [...atuais, {
      chave: crypto.randomUUID(), tipo: produto.tipo,
      kit_id: produto.tipo === 'KIT' ? produto.id : null,
      estoque_item_id: produto.tipo === 'ITEM_ESTOQUE' ? produto.id : null,
      nome_snapshot: produto.nome, quantidade: '1',
      valor_referencia: produto.valor === null ? '' : String(produto.valor), observacoes: null
    }])
    setSelecionado('')
    setSucesso('')
  }
  async function salvar() {
    if (!linhasValidas || !resumo.valido || desconto.trim() === '') {
      setErro('Revise descrição, quantidade, preço e desconto antes de salvar.')
      return
    }
    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Entre novamente no ERP.')
      const resposta = await fetch(`/api/comercial/pre-reservas/${pedido.id}/valores`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versao, desconto_tipo: tipo, desconto_valor: Number(desconto),
          itens: linhas.map(({ chave: _chave, ...linha }) => ({ ...linha,
            quantidade: Number(linha.quantidade), valor_referencia: Number(linha.valor_referencia)
          }))
        })
      })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível salvar os itens.')
      setSucesso('Itens e valores salvos.')
      await onSaved()
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar os itens.')
    } finally { setSalvando(false) }
  }
  return <div className="space-y-3 border-t pt-3">
    <h4 className="font-bold">Editar itens e valores</h4>
    <p className="text-xs text-slate-600">Os preços abaixo valem apenas para este pedido. Alterações são aplicadas ao clicar em salvar.</p>
    <fieldset disabled={salvando} className="min-w-0 space-y-3">
      {linhas.map((linha, indice) => <div key={linha.chave} className="space-y-2 rounded-xl border bg-slate-50 p-3">
        <Input label={`Descrição do item ${indice + 1}`} maxLength={300} value={linha.nome_snapshot} onChange={e => atualizar(linha.chave, { nome_snapshot: e.target.value })} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input label={`Quantidade do item ${indice + 1}`} type="number" min="0.01" step="0.01" value={linha.quantidade} onChange={e => atualizar(linha.chave, { quantidade: e.target.value })} />
          <Input label={`Preço unitário do item ${indice + 1} (R$)`} type="number" min="0" step="0.01" value={linha.valor_referencia === '0' ? '0.00' : linha.valor_referencia} onChange={e => atualizar(linha.chave, { valor_referencia: e.target.value })} />
        </div>
        <Input label={`Observações do item ${indice + 1}`} value={linha.observacoes || ''} onChange={e => atualizar(linha.chave, { observacoes: e.target.value })} />
        <div className="flex items-center justify-between gap-2">
          <strong>{moeda(Number(linha.quantidade) * Number(linha.valor_referencia))}</strong>
          <Button type="button" variant="secondary" aria-label={`Remover item ${indice + 1}`} onClick={() => setLinhas(atuais => atuais.filter(item => item.chave !== linha.chave))}>Remover item</Button>
        </div>
      </div>)}
      {erroCatalogo && <p role="status" className="text-amber-800">{erroCatalogo}</p>}
      <Select className="min-w-0 max-w-full" label="Adicionar item do catálogo" value={selecionado} onChange={e => setSelecionado(e.target.value)}>
        <option value="">Selecione um kit ou item</option>
        {catalogo.map(item => <option key={`${item.tipo}:${item.id}`} value={`${item.tipo}:${item.id}`}>{item.tipo === 'KIT' ? 'Kit' : 'Item'} · {item.nome}</option>)}
      </Select>
      <Button type="button" variant="secondary" disabled={!selecionado || linhas.length >= 100} onClick={adicionar}>Adicionar ao pedido</Button>
      <div className="grid gap-2 sm:grid-cols-2">
        <Select label="Tipo de desconto" value={tipo} onChange={e => { setTipo(e.target.value as TipoDescontoPreReserva); setDesconto('0') }}>
          <option value="VALOR">Valor em reais (R$)</option><option value="PERCENTUAL">Percentual (%)</option>
        </Select>
        <Input label={tipo === 'PERCENTUAL' ? 'Desconto (%)' : 'Desconto (R$)'} type="number" min="0" step="0.01" value={desconto === '0' ? '0.00' : desconto} onChange={e => setDesconto(e.target.value)} />
      </div>
      <p>Subtotal: <strong>{moeda(subtotal)}</strong></p>
      <p>Desconto: <strong>{moeda(resumo.descontoCalculado)}</strong></p>
      <p className="rounded-lg bg-pink-50 p-3 text-pink-800">Total final: <strong>{moeda(resumo.total)}</strong></p>
      <Button type="button" disabled={!linhasValidas || !resumo.valido || desconto.trim() === ''} onClick={() => void salvar()}>{salvando ? 'Salvando...' : 'Salvar itens, valores e desconto'}</Button>
    </fieldset>
    {erro && <p role="alert" className="text-red-700">{erro}</p>}
    {sucesso && <p role="status" className="text-green-700">{sucesso}</p>}
  </div>
}
