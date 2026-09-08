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

type Kit = {
  id: string
  codigo: string | null
  nome: string
  tema: string | null
  categoria: string | null
  quantidade: number | null
  valor: number | null
  status: string | null
  foto_url: string | null
  descricao: string | null
  observacoes: string | null
}

const vazio = {
  codigo: '',
  nome: '',
  tema: '',
  categoria: '',
  quantidade: 1,
  valor: 0,
  status: 'Disponível',
  foto_url: '',
  descricao: '',
  observacoes: ''
}

function moeda(valor: number | null) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

export function KitsModule() {
  const [kits, setKits] = useState<Kit[]>([])
  const [form, setForm] = useState(vazio)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [fotoArquivo, setFotoArquivo] = useState<File | null>(null)
  const [fotoRemovida, setFotoRemovida] = useState(false)

  async function carregar() {
    const { data, error } = await supabase
      .from('kits')
      .select('id,codigo,nome,tema,categoria,quantidade,valor,status,foto_url,descricao,observacoes')
      .order('nome')

    if (error) setErro(error.message)
    else setKits(data || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const categorias = useMemo(() => Array.from(new Set(kits.map(kit => kit.categoria).filter((categoria): categoria is string => Boolean(categoria)))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [kits])
  const filtrados = useMemo(() => kits.filter(kit =>
    correspondeBusca(busca, [kit.codigo, kit.nome, kit.tema, kit.categoria, kit.descricao])
    && (!filtroStatus || kit.status === filtroStatus)
    && (!filtroCategoria || kit.categoria === filtroCategoria)
  ).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base', numeric: true })), [busca, kits, filtroStatus, filtroCategoria])

  function limparFormulario() {
    setForm(vazio)
    setEditandoId(null)
    setFotoArquivo(null)
    setFotoRemovida(false)
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (!form.codigo.trim() || !form.nome.trim()) {
      setErro('Código e nome do kit são obrigatórios.')
      return
    }

    setSalvando(true)
    const fotoAnterior = form.foto_url || null
    const payload = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      tema: form.tema.trim() || null,
      categoria: form.categoria.trim() || null,
      quantidade: Number(form.quantidade) || 1,
      valor: Number(form.valor) || 0,
      status: form.status || 'Disponível',
      foto_url: fotoRemovida ? null : fotoAnterior,
      descricao: form.descricao.trim() || null,
      observacoes: form.observacoes.trim() || null
    }

    const resposta = editandoId
      ? await supabase.from('kits').update(payload).eq('id', editandoId).select('id').single()
      : await supabase.from('kits').insert(payload).select('id').single()

    if (resposta.error) {
      setErro(resposta.error.message.includes('duplicate') ? 'Código de kit já cadastrado.' : resposta.error.message)
      setSalvando(false)
      return
    }

    const registroId = resposta.data.id

    try {
      if (fotoArquivo) {
        const novaFoto = await enviarFotoCatalogo(fotoArquivo, 'kits', registroId)
        const { error: fotoError } = await supabase
          .from('kits')
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
        await excluirFotoCatalogo(fotoAnterior)
      }
    } catch (error) {
      setErro(`Os dados foram salvos, mas a foto não foi atualizada: ${error instanceof Error ? error.message : 'erro no envio'}`)
      setSalvando(false)
      await carregar()
      return
    }

    setSucesso(editandoId ? 'Kit e foto atualizados com sucesso.' : 'Kit cadastrado com sucesso.')
    limparFormulario()
    setSalvando(false)
    await carregar()
  }

  function editar(kit: Kit) {
    setEditandoId(kit.id)
    setForm({
      codigo: kit.codigo || '',
      nome: kit.nome || '',
      tema: kit.tema || '',
      categoria: kit.categoria || '',
      quantidade: kit.quantidade || 1,
      valor: kit.valor || 0,
      status: kit.status || 'Disponível',
      foto_url: kit.foto_url || '',
      descricao: kit.descricao || '',
      observacoes: kit.observacoes || ''
    })
    setFotoArquivo(null)
    setFotoRemovida(false)
    setErro('')
    setSucesso('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function retirarDoCatalogo(kit: Kit) {
    if (!confirm(`Retirar o kit "${kit.nome}" do catálogo? O histórico de reservas será preservado.`)) return

    setErro('')
    setSucesso('')
    const { error } = await supabase
      .from('kits')
      .update({ status: 'Inativo' })
      .eq('id', kit.id)

    if (error) {
      setErro(error.message)
      return
    }

    setSucesso('Kit retirado do catálogo. Reservas e registros anteriores foram preservados.')
    await carregar()
  }

  return (
    <div className="space-y-6 p-4 pb-28 md:p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Kits</h1>
        <p className="text-slate-500">Cadastre temas, valores, disponibilidade e fotos para o ERP e o site.</p>
        <a href="#lista-kits" className="mt-2 inline-block text-sm font-semibold text-pink-700 underline">Ir para kits cadastrados</a>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      <Card>
        <form onSubmit={salvar} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{editandoId ? 'Editar kit' : 'Novo kit'}</h2>
            <p className="text-sm text-slate-500">A foto principal será disponibilizada automaticamente no catálogo do site.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Código do kit *" placeholder="Ex.: KIT-001" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} />
            <Input label="Nome do kit *" placeholder="Nome para identificação" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            <Input label="Tema" placeholder="Ex.: Jardim encantado" value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} />
            <Input label="Categoria" placeholder="Ex.: Infantil" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
            <Input label="Quantidade disponível" type="number" min="1" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: Number(e.target.value) })} />
            <Input label="Valor da locação" type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: Number(e.target.value) })} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Disponível</option>
              <option>Reservado</option>
              <option>Manutenção</option>
              <option>Inativo</option>
            </Select>
          </div>

          <Textarea label="Descrição pública" placeholder="Apresentação do kit para o cliente e para o site..." value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
          <Textarea label="Observações internas" placeholder="Informações operacionais que não serão enviadas ao site..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

          <FotoCatalogoField
            fotoAtual={form.foto_url}
            arquivo={fotoArquivo}
            removida={fotoRemovida}
            desabilitado={salvando}
            onArquivo={arquivo => { setFotoArquivo(arquivo); setFotoRemovida(false) }}
            onRemover={() => { setFotoArquivo(null); setFotoRemovida(true) }}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : editandoId ? 'Salvar edição' : 'Cadastrar kit'}</Button>
            {editandoId && <Button variant="secondary" onClick={limparFormulario}>Cancelar</Button>}
          </div>
        </form>
      </Card>

      <Card>
        <div id="lista-kits" className="mb-4 scroll-mt-24 space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kits cadastrados</h2>
            <p className="text-sm text-slate-500" role="status">{filtrados.length} de {kits.length} kit(s)</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Buscar kit" placeholder="Nome, código, tema ou descrição..." value={busca} onChange={e => setBusca(e.target.value)} />
            <Select label="Categoria" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categorias.map(categoria => <option key={categoria}>{categoria}</option>)}
            </Select>
            <Select label="Status" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Array.from(new Set(kits.map(kit => kit.status).filter((status): status is string => Boolean(status)))).sort().map(status => <option key={status}>{status}</option>)}
            </Select>
          </div>
          {(busca || filtroStatus || filtroCategoria) && <Button variant="secondary" onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroCategoria('') }}>Limpar busca e filtros</Button>}
        </div>

        <div className="space-y-2">
          {filtrados.map(kit => (
            <article key={kit.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {kit.foto_url ? <img src={kit.foto_url} alt={kit.nome} className="h-full w-full object-contain" loading="lazy" /> : <span className="flex h-full items-center justify-center text-xs text-slate-400">Sem foto</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold text-slate-900">{kit.nome}</h3>
                  <p className="break-words text-xs text-slate-500">{kit.codigo || 'Sem código'} · {kit.tema || 'Sem tema'} · {kit.categoria || 'Sem categoria'}</p>
                  <p className="mt-1 text-sm"><strong>{moeda(kit.valor)}</strong> · Quantidade {kit.quantidade || 0} · {kit.status || 'Disponível'}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => editar(kit)} aria-label={`Editar kit ${kit.nome}`}>Editar</Button>
                {kit.status !== 'Inativo' && <Button variant="danger" onClick={() => retirarDoCatalogo(kit)}>Retirar do catálogo</Button>}
              </div>
              {(kit.foto_url || kit.descricao) && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm font-medium text-pink-700">Ver foto e descrição</summary>
                  {kit.foto_url && <img src={kit.foto_url} alt={kit.nome} className="mt-3 max-h-80 max-w-full rounded-lg object-contain" loading="lazy" />}
                  {kit.descricao && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{kit.descricao}</p>}
                </details>
              )}
            </article>
          ))}
        </div>

        {filtrados.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Nenhum kit encontrado.</div>
        )}
      </Card>
    </div>
  )
}
