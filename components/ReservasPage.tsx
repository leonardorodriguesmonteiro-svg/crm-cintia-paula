'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useAcesso } from '@/components/auth/AcessoContext'

type Cliente = { id: string; nome: string; whatsapp: string | null }
type Kit = { id: string; nome: string; codigo: string | null; valor: number | null }
type Composicao = {
  id: string
  kit_id: string
  valor_ajuste: number
  estoque_itens: { nome: string; codigo: string | null } | null
}
type ReservaItem = {
  id?: string
  kit_id: string | null
  kit_composicao_id?: string | null
  descricao: string
  quantidade: number
  valor_unitario: number
  subtotal?: number
  kits?: Kit | null
  kit_composicao?: { kit_id: string } | null
}

type LinhaForm = ReservaItem & {
  chave: string
  composicao_kit_id?: string | null
}

type Reserva = {
  id: string
  data_evento: string
  horario_evento: string | null
  endereco_evento: string | null
  valor_total: number | null
  valor_sinal: number | null
  status: string | null
  observacoes: string | null
  clientes: Cliente | null
  kits: Kit | null
  reserva_itens: ReservaItem[]
}

const vazio = {
  cliente_id: '',
  kit_id: '',
  data_evento: '',
  horario_evento: '',
  endereco_evento: '',
  valor_sinal: 0,
  status: 'Pendente',
  observacoes: ''
}

function chaveLinha() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function dataCurta(valor: string | null | undefined) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ReservasPage() {
  const { acesso } = useAcesso()
  const podeGerenciar = acesso?.perfil === 'Administrador' || acesso?.perfil === 'Comercial'
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [composicoes, setComposicoes] = useState<Composicao[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [form, setForm] = useState(vazio)
  const [linhas, setLinhas] = useState<LinhaForm[]>([])
  const [kitAdicionar, setKitAdicionar] = useState('')
  const [descricaoAdicional, setDescricaoAdicional] = useState('')
  const [valorAdicional, setValorAdicional] = useState(0)
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregarBase() {
    const [clientesRes, kitsRes, ajustesRes] = await Promise.all([
      supabase.from('clientes').select('id,nome,whatsapp').order('nome'),
      supabase.from('kits').select('id,nome,codigo,valor').order('nome'),
      supabase.from('kit_composicao').select('id,kit_id,valor_ajuste,estoque_itens(nome,codigo)')
    ])

    if (clientesRes.error) setErro(clientesRes.error.message)
    else setClientes(clientesRes.data || [])

    if (kitsRes.error) setErro(kitsRes.error.message)
    else setKits([...(kitsRes.data || [])].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    ))

    if (ajustesRes.error) setErro(ajustesRes.error.message)
    else {
      setComposicoes((ajustesRes.data as any) || [])
    }
  }

  async function carregarReservas() {
    const { data, error } = await supabase
      .from('reservas')
      .select('id,data_evento,horario_evento,endereco_evento,valor_total,valor_sinal,status,observacoes,clientes(id,nome,whatsapp),kits(id,nome,codigo,valor),reserva_itens(id,kit_id,kit_composicao_id,descricao,quantidade,valor_unitario,subtotal,kits(id,nome,codigo,valor),kit_composicao(kit_id))')
      .order('data_evento', { ascending: true })

    if (error) return setErro(error.message)
    setReservas((data as any) || [])
  }

  useEffect(() => {
    carregarBase()
    carregarReservas()
  }, [])

  const filtradas = useMemo(() => {
    const termo = busca.toLowerCase()
    return reservas.filter((reserva) =>
      [
        reserva.clientes?.nome,
        reserva.kits?.nome,
        ...(reserva.reserva_itens || []).map(item => item.descricao),
        reserva.status,
        reserva.data_evento,
        reserva.endereco_evento
      ].join(' ').toLowerCase().includes(termo)
    )
  }, [reservas, busca])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setSalvando(true)

    if (!form.cliente_id) {
      setErro('Selecione um cliente.')
      setSalvando(false)
      return
    }

    if (!linhas.some(linha => linha.kit_id)) {
      setErro('Adicione pelo menos um kit à reserva.')
      setSalvando(false)
      return
    }

    if (!form.data_evento) {
      setErro('Informe a data do evento.')
      setSalvando(false)
      return
    }

    const { error: salvarError } = await supabase.rpc('salvar_reserva_com_itens', {
      p_reserva_id: editando,
      p_cliente_id: form.cliente_id,
      p_data_evento: form.data_evento,
      p_horario_evento: form.horario_evento || null,
      p_endereco_evento: form.endereco_evento || null,
      p_valor_sinal: Number(form.valor_sinal) || 0,
      p_status: form.status,
      p_observacoes: form.observacoes || null,
      p_itens: linhas.map(linha => ({
        kit_id: linha.kit_id,
        kit_composicao_id: linha.kit_composicao_id || null,
        descricao: linha.descricao,
        quantidade: linha.kit_id ? 1 : Number(linha.quantidade) || 1,
        valor_unitario: Number(linha.valor_unitario) || 0
      }))
    })

    if (salvarError) {
      setErro(salvarError.message)
      setSalvando(false)
      return
    }

    setForm(vazio)
    setLinhas([])
    setEditando(null)
    setSalvando(false)
    carregarReservas()
  }

  function editar(reserva: Reserva) {
    setEditando(reserva.id)
    setForm({
      cliente_id: reserva.clientes?.id || '',
      kit_id: reserva.kits?.id || '',
      data_evento: reserva.data_evento || '',
      horario_evento: reserva.horario_evento || '',
      endereco_evento: reserva.endereco_evento || '',
      valor_sinal: reserva.valor_sinal || 0,
      status: reserva.status || 'Pendente',
      observacoes: reserva.observacoes || ''
    })
    const itens = reserva.reserva_itens?.length
      ? reserva.reserva_itens
      : reserva.kits
        ? [{
            kit_id: reserva.kits.id,
            descricao: reserva.kits.nome,
            quantidade: 1,
            valor_unitario: Number(reserva.valor_total || reserva.kits.valor || 0)
          }]
        : []
    setLinhas(itens.map(item => ({
      chave: chaveLinha(),
      kit_id: item.kit_id,
      kit_composicao_id: item.kit_composicao_id || null,
      composicao_kit_id: item.kit_composicao?.kit_id || null,
      descricao: item.descricao,
      quantidade: Number(item.quantidade || 1),
      valor_unitario: Number(item.valor_unitario || 0)
    })))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function excluir(id: string) {
    if (!confirm('Deseja excluir esta reserva?')) return
    const { error } = await supabase.from('reservas').delete().eq('id', id)
    if (error) return setErro(error.message)
    carregarReservas()
  }

  function adicionarKit() {
    const kit = kits.find(item => item.id === kitAdicionar)
    if (!kit) return setErro('Selecione o kit que deseja adicionar.')
    if (linhas.some(linha => linha.kit_id === kit.id)) return setErro('Este kit já foi adicionado à reserva.')

    const linhasComposicao = composicoes
      .filter(item => item.kit_id === kit.id && Number(item.valor_ajuste || 0) !== 0)
      .map(item => ({
        chave: chaveLinha(),
        kit_id: null,
        kit_composicao_id: item.id,
        composicao_kit_id: item.kit_id,
        descricao: item.estoque_itens?.nome || 'Composição do kit',
        quantidade: 1,
        valor_unitario: Number(item.valor_ajuste || 0)
      }))

    setLinhas(atuais => [...atuais, {
      chave: chaveLinha(),
      kit_id: kit.id,
      kit_composicao_id: null,
      descricao: kit.nome,
      quantidade: 1,
      valor_unitario: Number(kit.valor || 0)
    }, ...linhasComposicao])
    setKitAdicionar('')
    setErro('')
  }

  function adicionarItemLivre() {
    if (descricaoAdicional.trim().length < 2) return setErro('Descreva o adicional, composição ou desconto.')
    setLinhas(atuais => [...atuais, {
      chave: chaveLinha(),
      kit_id: null,
      kit_composicao_id: null,
      descricao: descricaoAdicional.trim(),
      quantidade: 1,
      valor_unitario: Number(valorAdicional) || 0
    }])
    setDescricaoAdicional('')
    setValorAdicional(0)
    setErro('')
  }

  function atualizarLinha(chave: string, alteracoes: Partial<LinhaForm>) {
    setLinhas(atuais => atuais.map(linha => linha.chave === chave ? { ...linha, ...alteracoes } : linha))
  }

  function removerLinha(linhaRemovida: LinhaForm) {
    setLinhas(atuais => atuais.filter(linha =>
      linha.chave !== linhaRemovida.chave &&
      (!linhaRemovida.kit_id || linha.composicao_kit_id !== linhaRemovida.kit_id)
    ))
  }

  const composicoesSelecionadas = composicoes.filter(composicao =>
    Number(composicao.valor_ajuste || 0) !== 0 &&
    linhas.some(linha => linha.kit_id === composicao.kit_id)
  )
  const composicoesPorId = new Map(composicoesSelecionadas.map(item => [item.id, item]))
  const composicoesAusentes = composicoesSelecionadas.filter(composicao =>
    !linhas.some(linha => linha.kit_composicao_id === composicao.id)
  )
  const composicoesDesatualizadas = linhas.filter(linha => {
    if (!linha.kit_composicao_id) return false
    const atual = composicoesPorId.get(linha.kit_composicao_id)
    return !atual || Math.abs(Number(linha.valor_unitario || 0) - Number(atual.valor_ajuste || 0)) > 0.005
  })
  const precisaSincronizarComposicoes = Boolean(
    editando && (composicoesAusentes.length || composicoesDesatualizadas.length)
  )

  function sincronizarComposicoes() {
    setLinhas(atuais => {
      const kitsAtuais = new Set(atuais.map(linha => linha.kit_id).filter(Boolean))
      const esperadas = composicoes.filter(composicao =>
        kitsAtuais.has(composicao.kit_id) && Number(composicao.valor_ajuste || 0) !== 0
      )
      const esperadasPorId = new Map(esperadas.map(item => [item.id, item]))
      const atualizadas = atuais
        .filter(linha => !linha.kit_composicao_id || esperadasPorId.has(linha.kit_composicao_id))
        .map(linha => {
          if (!linha.kit_composicao_id) return linha
          const composicao = esperadasPorId.get(linha.kit_composicao_id)!
          return {
            ...linha,
            composicao_kit_id: composicao.kit_id,
            descricao: composicao.estoque_itens?.nome || linha.descricao,
            quantidade: 1,
            valor_unitario: Number(composicao.valor_ajuste || 0)
          }
        })
      const idsAtuais = new Set(atualizadas.map(linha => linha.kit_composicao_id).filter(Boolean))
      const novas = esperadas
        .filter(composicao => !idsAtuais.has(composicao.id))
        .map(composicao => ({
          chave: chaveLinha(),
          kit_id: null,
          kit_composicao_id: composicao.id,
          composicao_kit_id: composicao.kit_id,
          descricao: composicao.estoque_itens?.nome || 'Composição do kit',
          quantidade: 1,
          valor_unitario: Number(composicao.valor_ajuste || 0)
        }))
      return [...atualizadas, ...novas]
    })
    setErro('')
  }

  const valorTotalCalculado = Math.max(linhas.reduce(
    (total, linha) => total + Number(linha.quantidade || 0) * Number(linha.valor_unitario || 0),
    0
  ), 0)

  return (
    <div className="space-y-6 p-4 md:p-8 pb-28">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Reservas</h1>
        <p className="text-slate-500">Cadastre e acompanhe as reservas dos kits.</p>
      </div>

      {podeGerenciar ? <Card>
        <form onSubmit={salvar} className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editando ? 'Editar reserva' : 'Nova reserva'}
            </h2>
            <p className="text-sm text-slate-500">
              Selecione o cliente e monte a reserva com quantos kits, composições e ajustes forem necessários.
            </p>
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <Select label="Cliente *" value={form.cliente_id} onChange={e => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">Selecione um cliente...</option>
              {clientes.map(cliente => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-4 rounded-2xl border bg-slate-50 p-4">
            <div>
              <h3 className="font-semibold text-slate-900">Kits e itens da reserva</h3>
              <p className="text-sm text-slate-500">Selecione o kit pelo nome. Valores e variações são definidos nas linhas da reserva.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Select label="Adicionar kit" value={kitAdicionar} onChange={e => setKitAdicionar(e.target.value)}>
                <option value="">Selecione um kit...</option>
                {kits.map(kit => (
                  <option key={kit.id} value={kit.id}>
                    {kit.codigo ? `${kit.codigo} - ` : ''}{kit.nome}
                  </option>
                ))}
              </Select>
              <Button type="button" className="self-end" onClick={adicionarKit}>Adicionar kit</Button>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <Input label="Adicional, composição ou desconto" placeholder="Ex.: arranjo extra ou desconto promocional" value={descricaoAdicional} onChange={e => setDescricaoAdicional(e.target.value)} />
              <Input label="Valor (R$)" type="number" step="0.01" placeholder="Use negativo para desconto" value={valorAdicional} onChange={e => setValorAdicional(Number(e.target.value))} />
              <Button type="button" variant="secondary" className="self-end" onClick={adicionarItemLivre}>Adicionar ajuste</Button>
            </div>

            <div className="space-y-2">
              {precisaSincronizarComposicoes && (
                <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">As composições deste kit mudaram após a reserva.</p>
                    <p>Revise e aplique os valores atuais antes de salvar. Nada será alterado sem sua confirmação.</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={sincronizarComposicoes}>Atualizar composições</Button>
                </div>
              )}
              {linhas.map(linha => (
                <div key={linha.chave} className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[1fr_110px_150px_auto] md:items-end">
                  {linha.kit_id || linha.kit_composicao_id ? (
                    <div className="min-w-0">
                      <p className="mb-1 text-sm font-medium text-slate-700">{linha.kit_id ? 'Kit' : 'Composição'}</p>
                      <div className="min-h-11 whitespace-normal break-words rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-800" title={linha.descricao}>
                        {linha.descricao}
                      </div>
                    </div>
                  ) : (
                    <Input label="Descrição" value={linha.descricao} onChange={e => atualizarLinha(linha.chave, { descricao: e.target.value })} />
                  )}
                  <Input label="Quantidade" type="number" min="0.01" step="0.01" disabled={Boolean(linha.kit_id || linha.kit_composicao_id)} value={linha.quantidade} onChange={e => atualizarLinha(linha.chave, { quantidade: Number(e.target.value) })} />
                  <Input label="Valor unitário (R$)" type="number" step="0.01" value={linha.valor_unitario} onChange={e => atualizarLinha(linha.chave, { valor_unitario: Number(e.target.value) })} />
                  <Button type="button" variant="danger" onClick={() => removerLinha(linha)}>Remover</Button>
                </div>
              ))}
              {linhas.length === 0 && <p className="rounded-xl border border-dashed bg-white p-5 text-center text-sm text-slate-500">Adicione os kits e ajustes que fazem parte desta reserva.</p>}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-pink-50 px-4 py-3 text-pink-900">
              <span className="text-sm font-semibold">Total calculado automaticamente</span>
              <strong className="text-xl">{moeda(valorTotalCalculado)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Data do evento *" type="date" value={form.data_evento} onChange={e => setForm({ ...form, data_evento: e.target.value })} />
            <Input label="Horário" placeholder="Ex.: 14:00" value={form.horario_evento} onChange={e => setForm({ ...form, horario_evento: e.target.value })} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option>Pendente</option>
              <option>Confirmada</option>
              <option>Em andamento</option>
              <option>Concluída</option>
              <option>Cancelada</option>
            </Select>
          </div>

          <Input label="Endereço do evento" placeholder="Rua, número, bairro, cidade" value={form.endereco_evento} onChange={e => setForm({ ...form, endereco_evento: e.target.value })} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Valor do sinal" type="number" value={form.valor_sinal} onChange={e => setForm({ ...form, valor_sinal: Number(e.target.value) })} />
            <Input label="Valor total" value={moeda(valorTotalCalculado)} readOnly />
          </div>

          <Textarea label="Observações" placeholder="Detalhes da reserva..." value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />

          <div className="flex flex-col sm:flex-row gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar edição' : 'Criar reserva'}
            </Button>

            {editando && (
              <Button variant="secondary" onClick={() => { setEditando(null); setForm(vazio); setLinhas([]) }}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card> : <Card><div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Seu perfil possui acesso de consulta às reservas. A criação, edição e exclusão ficam sob responsabilidade do Comercial.</div>{erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}</Card>}

      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Reservas cadastradas</h2>
            <p className="text-sm text-slate-500">{filtradas.length} reserva(s) encontrada(s)</p>
          </div>

          <Input placeholder="Buscar reserva..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filtradas.map(reserva => (
            <div key={reserva.id} className="rounded-2xl border p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {reserva.clientes?.nome || 'Cliente não informado'}
                </p>
                <p className="text-sm text-slate-500">
                  {(reserva.reserva_itens || []).filter(item => item.kit_id).map(item => item.kits?.nome || item.descricao).join(' + ') || reserva.kits?.nome || 'Kit não informado'} • {dataCurta(reserva.data_evento)}
                  {reserva.horario_evento ? ` às ${reserva.horario_evento}` : ''}
                </p>
                <p className="text-sm text-slate-600">
                  Total: {moeda(Number(reserva.valor_total || 0))} • Sinal: {moeda(Number(reserva.valor_sinal || 0))}
                </p>
                {reserva.endereco_evento && (
                  <p className="text-sm text-slate-600">Local: {reserva.endereco_evento}</p>
                )}
              </div>

              <div className="flex flex-col md:items-end gap-2">
                <span className="text-xs bg-pink-50 text-pink-700 rounded-full px-3 py-1 w-fit">
                  {reserva.status}
                </span>

                <div className="flex gap-2">
                  <Link href={`/reservas/${reserva.id}`}>
                    <Button>Abrir</Button>
                  </Link>

                  {podeGerenciar && <Button variant="secondary" onClick={() => editar(reserva)}>
                    Editar
                  </Button>}

                  {podeGerenciar && <Button variant="danger" onClick={() => excluir(reserva.id)}>
                    Excluir
                  </Button>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtradas.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            Nenhuma reserva encontrada.
          </div>
        )}
      </Card>
    </div>
  )
}
