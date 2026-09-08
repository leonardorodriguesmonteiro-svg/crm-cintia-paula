'use client'

import { useEffect, useMemo, useState } from 'react'
import { correspondeBusca } from '@/lib/catalogoBusca'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FotoCatalogoField } from '@/components/catalogo/FotoCatalogoField'
import { enviarFotoCatalogo, excluirFotoCatalogo } from '@/lib/catalogoFotos'

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
  foto_url: string | null
}

type Movimento = {
  id: string
  tipo: string
  quantidade: number
  saldo_total_depois: number
  saldo_manutencao_depois: number
  criado_em: string
  estoque_itens: {
    codigo: string | null
    nome: string
  } | null
  conferencias: {
    reservas: {
      numero: string | null
    } | null
  } | null
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
  status: 'Disponível',
  foto_url: ''
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export function EstoqueClient() {
  const [itens, setItens] = useState<Item[]>([])
  const [movimentos, setMovimentos] = useState<Movimento[]>([])
  const [form, setForm] = useState(vazio)
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [fotoRemovida, setFotoRemovida] = useState(false)

  async function carregar() {
    const [itensRes, movimentosRes] = await Promise.all([
      supabase
        .from('estoque_itens')
        .select('*')
        .order('nome', { ascending: true }),
      supabase
        .from('movimentos_estoque')
        .select('id,tipo,quantidade,saldo_total_depois,saldo_manutencao_depois,criado_em,estoque_itens!movimentos_estoque_item_id_fkey(codigo,nome),conferencias(reservas(numero))')
        .order('criado_em', { ascending: false })
        .limit(50)
    ])

    if (itensRes.error) return setErro(itensRes.error.message)
    if (movimentosRes.error) return setErro(movimentosRes.error.message)
    setItens(itensRes.data || [])
    setMovimentos((movimentosRes.data as any) || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = useMemo(() => {
    return itens.filter((item) => {
      const encontrado = correspondeBusca(busca, [item.nome, item.codigo, item.categoria, item.cor, item.localizacao, item.observacoes])
      const correspondeCategoria = !filtroCategoria || item.categoria === filtroCategoria
      const correspondeStatus = !filtroStatus || item.status === filtroStatus
      return encontrado && correspondeCategoria && correspondeStatus
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true }))
  }, [itens, busca, filtroCategoria, filtroStatus])

  const categorias = useMemo(() => Array.from(new Set(
    itens.map(item => item.categoria).filter((valor): valor is string => Boolean(valor))
  )).sort((a, b) => a.localeCompare(b, 'pt-BR')), [itens])

  const statusDisponiveis = useMemo(() => Array.from(new Set(
    itens.map(item => item.status).filter((valor): valor is string => Boolean(valor))
  )).sort((a, b) => a.localeCompare(b, 'pt-BR')), [itens])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    if (!form.nome.trim()) {
      setErro('Informe o nome do item.')
      setSalvando(false)
      return
    }

    if (Number(form.quantidade_manutencao) > Number(form.quantidade_total)) {
      setErro('A quantidade em manutenção não pode ser maior que a quantidade total.')
      setSalvando(false)
      return
    }

    const payload = {
      ...form,
      codigo: form.codigo.trim() || null,
      nome: form.nome.trim(),
      foto_url: fotoRemovida ? null : form.foto_url || null,
      quantidade_total: Number(form.quantidade_total) || 0,
      quantidade_manutencao: Number(form.quantidade_manutencao) || 0,
      valor_reposicao: Number(form.valor_reposicao) || 0
    }

    const fotoAnterior = form.foto_url || null
    const resposta = editando
      ? await supabase.from('estoque_itens').update(payload).eq('id', editando).select('id').single()
      : await supabase.from('estoque_itens').insert(payload).select('id').single()

    if (resposta.error) {
      setErro(resposta.error.message)
      setSalvando(false)
      return
    }

    const registroId = resposta.data.id

    try {
      if (fotoArquivo) {
        const novaFoto = await enviarFotoCatalogo(fotoArquivo, 'estoque', registroId)
        const { error: fotoError } = await supabase
          .from('estoque_itens')
          .update({ foto_url: novaFoto.url })
          .eq('id', registroId)

        if (fotoError) {
          await excluirFotoCatalogo(novaFoto.url)
          throw fotoError
        }

        if (fotoAnterior && fotoAnterior !== novaFoto.url) {
          await excluirFotoCatalogo(fotoAnterior)
        }
      } else if (fotoRemovida && fotoAnterior) {
        await supabase.from('estoque_itens').update({ foto_url: null }).eq('id', registroId)
        await excluirFotoCatalogo(fotoAnterior)
      }
    } catch (error) {
      setErro(`Os dados foram salvos, mas a foto não foi atualizada: ${error instanceof Error ? error.message : 'erro no envio'}`)
      setSalvando(false)
      await carregar()
      return
    }

    setForm(vazio)
    setEditando(null)
    setFotoArquivo(null)
    setFotoRemovida(false)
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
      status: item.status || 'Disponível',
      foto_url: item.foto_url || ''
    })
    setFotoArquivo(null)
    setFotoRemovida(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id: string) {
    const { count, error: vinculoError } = await supabase
      .from('kit_composicao')
      .select('id', { count: 'exact', head: true })
      .eq('item_id', id)

    if (vinculoError) return setErro(vinculoError.message)
    if (count) {
      setErro('Este item faz parte da composição de um kit. Remova o vínculo antes de excluir.')
      return
    }

    if (!confirm('Deseja excluir este item do estoque?')) return
    const item = itens.find(registro => registro.id === id)
    const { error } = await supabase.from('estoque_itens').delete().eq('id', id)
    if (error) return setErro(error.message)
    try {
      await excluirFotoCatalogo(item?.foto_url)
    } catch {
      // O registro já foi excluído; uma eventual limpeza do arquivo pode ser refeita depois.
    }
    carregar()
  }

  const totalUnidades = itens.reduce((total, item) => total + Number(item.quantidade_total || 0), 0)
  const totalManutencao = itens.reduce((total, item) => total + Number(item.quantidade_manutencao || 0), 0)
  const totalDisponivel = itens.reduce((total, item) => total + Number(item.quantidade_disponivel || 0), 0)
  const valorPatrimonio = itens.reduce(
    (total, item) => total + Number(item.quantidade_total || 0) * Number(item.valor_reposicao || 0),
    0
  )

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Estoque</h1>
        <p className="text-slate-500">Controle os itens físicos usados nos kits.</p>
        <a href="#lista-estoque" className="mt-2 inline-block text-sm font-semibold text-pink-700 underline">Ir para itens cadastrados</a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Unidades totais</p><p className="mt-1 text-2xl font-bold">{totalUnidades}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Disponíveis</p><p className="mt-1 text-2xl font-bold">{totalDisponivel}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Em manutenção</p><p className="mt-1 text-2xl font-bold">{totalManutencao}</p></Card>
        <Card><p className="text-xs font-semibold uppercase text-slate-500">Patrimônio estimado</p><p className="mt-1 text-2xl font-bold">{moeda(valorPatrimonio)}</p></Card>
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
            <div>
              <Input label="Código interno (opcional)" placeholder="Gerado automaticamente" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
              <p className="mt-1 text-xs text-slate-500">Em branco, o sistema gera o próximo código EST-0001.</p>
            </div>
            <Input label="Nome do item *" placeholder="Ex.: Painel redondo Safari" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            <Input label="Categoria" placeholder="Ex.: Painéis" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
            <Input label="Cor" placeholder="Ex.: Branco" value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} />
          </div>

          <div className="rounded-2xl border bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Quantidades</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Quantidade total" type="number" value={form.quantidade_total} onChange={e => setForm({ ...form, quantidade_total: Number(e.target.value) })} />
              <Input label="Quantidade em manutenção" type="number" value={form.quantidade_manutencao} onChange={e => setForm({ ...form, quantidade_manutencao: Number(e.target.value) })} />
              <div className="rounded-xl border bg-white px-3 py-2">
                <p className="text-sm font-medium text-slate-700">Quantidade disponível</p>
                <p className="mt-1 text-lg font-bold">
                  {Math.max(Number(form.quantidade_total) - Number(form.quantidade_manutencao), 0)}
                </p>
                <p className="text-xs text-slate-500">Calculada automaticamente</p>
              </div>
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

          <FotoCatalogoField
            fotoAtual={form.foto_url}
            arquivo={fotoArquivo}
            removida={fotoRemovida}
            desabilitado={salvando}
            onArquivo={arquivo => { setFotoArquivo(arquivo); setFotoRemovida(false) }}
            onRemover={() => { setFotoArquivo(null); setFotoRemovida(true) }}
          />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar edição' : 'Cadastrar item'}
            </Button>

            {editando && (
              <Button variant="secondary" onClick={() => { setEditando(null); setForm(vazio); setFotoArquivo(null); setFotoRemovida(false) }}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div id="lista-estoque" className="mb-4 scroll-mt-24 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Itens cadastrados</h2>
            <p className="text-sm text-slate-500">{filtrados.length} de {itens.length} item(ns)</p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input aria-label="Buscar item do estoque" placeholder="Nome, código, cor ou localização..." value={busca} onChange={e => setBusca(e.target.value)} />
            <Select aria-label="Filtrar por categoria" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map(categoria => <option key={categoria}>{categoria}</option>)}
            </Select>
            <Select aria-label="Filtrar por status" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {statusDisponiveis.map(status => <option key={status}>{status}</option>)}
            </Select>
          </div>
        </div>

        {(busca || filtroCategoria || filtroStatus) && <Button className="mb-3" variant="secondary" onClick={() => { setBusca(''); setFiltroCategoria(''); setFiltroStatus('') }}>Limpar busca e filtros</Button>}
        <div className="space-y-2">
          {filtrados.map(item => (
            <article key={item.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {item.foto_url ? <img src={item.foto_url} alt={item.nome} className="h-full w-full object-contain" loading="lazy" /> : <span className="flex h-full items-center justify-center text-xs text-slate-400">Sem foto</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold text-slate-900">{item.nome}</h3>
                  <p className="break-words text-xs text-slate-500">{item.codigo || 'Sem código'} · {item.categoria || 'Sem categoria'} · Cor: {item.cor || '-'}</p>
                  <p className="mt-1 text-sm">Disponível: <strong>{item.quantidade_disponivel || 0}</strong> · Total: {item.quantidade_total || 0} · Manutenção: {item.quantidade_manutencao || 0}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => editar(item)} aria-label={`Editar item ${item.nome}`}>Editar</Button>
                <Button variant="danger" onClick={() => excluir(item.id)} aria-label={`Excluir item ${item.nome}`}>Excluir</Button>
                <span className="text-xs text-slate-500">{item.status}</span>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-pink-700">Ver foto e detalhes</summary>
                {item.foto_url && <img src={item.foto_url} alt={item.nome} className="mt-3 max-h-80 max-w-full rounded-lg object-contain" loading="lazy" />}
                <p className="mt-2 break-words text-sm text-slate-600">Localização: {item.localizacao || '-'}</p>
                {item.observacoes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{item.observacoes}</p>}
              </details>
            </article>
          ))}
        </div>

        {filtrados.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            Nenhum item encontrado.
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Movimentações automáticas</h2>
          <p className="text-sm text-slate-500">Avarias, extravios e reversões gerados pelas conferências.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="p-3">Data</th>
                <th>Item</th>
                <th>Reserva</th>
                <th>Movimento</th>
                <th>Quantidade</th>
                <th>Saldo resultante</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map(movimento => (
                <tr key={movimento.id} className="border-b last:border-0">
                  <td className="p-3">{new Date(movimento.criado_em).toLocaleString('pt-BR')}</td>
                  <td>{movimento.estoque_itens?.codigo || '-'} — {movimento.estoque_itens?.nome || 'Item'}</td>
                  <td>{movimento.conferencias?.reservas?.numero || '—'}</td>
                  <td>{movimento.tipo}</td>
                  <td>{movimento.quantidade}</td>
                  <td>{movimento.saldo_total_depois} total · {movimento.saldo_manutencao_depois} manutenção</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {movimentos.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            Nenhuma movimentação automática registrada.
          </div>
        )}
      </Card>
    </div>
  )
}
