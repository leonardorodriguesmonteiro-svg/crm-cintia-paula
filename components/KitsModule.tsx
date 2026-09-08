'use client'

import { useEffect, useMemo, useState } from 'react'
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

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return kits.filter(kit =>
      [kit.codigo, kit.nome, kit.tema, kit.categoria, kit.status]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(termo)
    )
  }, [busca, kits])

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
        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_320px] md:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kits cadastrados</h2>
            <p className="text-sm text-slate-500">{filtrados.length} kit(s) encontrado(s)</p>
          </div>
          <Input placeholder="Buscar kit..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map(kit => (
            <div key={kit.id} className="overflow-hidden rounded-2xl border bg-white">
              <div className="aspect-[4/3] bg-slate-100">
                {kit.foto_url ? (
                  <img src={kit.foto_url} alt={kit.nome} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">Sem foto</div>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{kit.nome}</p>
                    <p className="text-sm text-slate-500">{kit.codigo || 'Sem código'} · {kit.tema || 'Sem tema'}</p>
                  </div>
                  <span className="rounded-full bg-pink-50 px-2 py-1 text-xs font-semibold text-pink-700">{kit.status || 'Disponível'}</span>
                </div>
                {kit.descricao && <p className="line-clamp-2 text-sm text-slate-600">{kit.descricao}</p>}
                <p className="text-sm"><strong>{moeda(kit.valor)}</strong> · Quantidade {kit.quantidade || 0}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => editar(kit)}>Editar</Button>
                  {kit.status !== 'Inativo' && (
                    <Button variant="danger" onClick={() => retirarDoCatalogo(kit)}>Retirar do catálogo</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtrados.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Nenhum kit encontrado.</div>
        )}
      </Card>
    </div>
  )
}