'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  MessageCircle,
  Plus,
  Search,
  Target,
  TrendingUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

const etapas = [
  'Novo contato',
  'Em atendimento',
  'Orçamento enviado',
  'Negociação',
  'Fechado',
  'Perdido'
] as const

const origens = [
  'WhatsApp',
  'Instagram',
  'Indicação',
  'Google',
  'Cliente recorrente',
  'Não informada'
]

type Etapa = (typeof etapas)[number]

type Cliente = {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
}

type Oportunidade = {
  id: string
  numero: number
  empresa_id: string | null
  cliente_id: string | null
  nome_contato: string
  celular: string
  email: string | null
  origem: string
  interesse: string | null
  data_evento: string | null
  quantidade_convidados: number | null
  valor_estimado: number
  etapa: Etapa
  proximo_contato: string | null
  motivo_perda: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

type Historico = {
  id: string
  oportunidade_id: string
  tipo: string
  descricao: string
  created_at: string
}

type FormOportunidade = {
  cliente_id: string
  nome_contato: string
  celular: string
  email: string
  origem: string
  interesse: string
  data_evento: string
  quantidade_convidados: string
  valor_estimado: number | string
  etapa: Etapa
  proximo_contato: string
  observacoes: string
}

const formVazio: FormOportunidade = {
  cliente_id: '',
  nome_contato: '',
  celular: '',
  email: '',
  origem: 'Não informada',
  interesse: '',
  data_evento: '',
  quantidade_convidados: '',
  valor_estimado: 0,
  etapa: 'Novo contato',
  proximo_contato: '',
  observacoes: ''
}

function somenteDigitos(valor = '') {
  return valor.replace(/\D/g, '')
}

function formatarCelular(valor = '') {
  const digitos = somenteDigitos(valor).slice(0, 11)
  if (digitos.length <= 2) return digitos
  if (digitos.length <= 7) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`
  const inicioNumero = digitos.length === 11 ? 7 : 6
  return `${digitos.slice(0, 2)} ${digitos.slice(2, inicioNumero)}-${digitos.slice(inicioNumero)}`
}

function moeda(valor: number | string | null) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function dataCurta(valor: string | null) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function corEtapa(etapa: Etapa) {
  const cores: Record<Etapa, string> = {
    'Novo contato': 'border-blue-200 bg-blue-50 text-blue-800',
    'Em atendimento': 'border-cyan-200 bg-cyan-50 text-cyan-800',
    'Orçamento enviado': 'border-violet-200 bg-violet-50 text-violet-800',
    Negociação: 'border-amber-200 bg-amber-50 text-amber-800',
    Fechado: 'border-green-200 bg-green-50 text-green-800',
    Perdido: 'border-slate-300 bg-slate-100 text-slate-700'
  }
  return cores[etapa]
}

export function FunilComercialPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [historicos, setHistoricos] = useState<Historico[]>([])
  const [form, setForm] = useState<FormOportunidade>(formVazio)
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [detalheAberto, setDetalheAberto] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setErro('')
    setCarregando(true)

    const [clientesRes, oportunidadesRes, historicosRes] = await Promise.all([
      supabase.from('clientes').select('id,nome,whatsapp,email').order('nome'),
      supabase.from('oportunidades').select('*').order('updated_at', { ascending: false }),
      supabase
        .from('oportunidade_historico')
        .select('id,oportunidade_id,tipo,descricao,created_at')
        .order('created_at', { ascending: false })
    ])

    const primeiroErro = clientesRes.error || oportunidadesRes.error || historicosRes.error

    if (primeiroErro) {
      setErro(primeiroErro.message)
    } else {
      setClientes(clientesRes.data || [])
      setOportunidades((oportunidadesRes.data as Oportunidade[]) || [])
      setHistoricos((historicosRes.data as Historico[]) || [])
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return oportunidades

    return oportunidades.filter(item =>
      [
        item.nome_contato,
        item.celular,
        item.origem,
        item.interesse,
        item.etapa,
        `OP-${String(item.numero).padStart(4, '0')}`
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termo)
    )
  }, [busca, oportunidades])

  const resumo = useMemo(() => {
    const abertas = oportunidades.filter(item => !['Fechado', 'Perdido'].includes(item.etapa))
    const fechadas = oportunidades.filter(item => item.etapa === 'Fechado')
    const potencial = abertas.reduce((total, item) => total + Number(item.valor_estimado || 0), 0)
    const hoje = new Date().toISOString().slice(0, 10)
    const retornos = abertas.filter(item => item.proximo_contato && item.proximo_contato <= hoje).length
    const totalDecididas = oportunidades.filter(item => ['Fechado', 'Perdido'].includes(item.etapa)).length

    return {
      abertas: abertas.length,
      potencial,
      retornos,
      conversao: totalDecididas ? Math.round((fechadas.length / totalDecididas) * 100) : 0
    }
  }, [oportunidades])

  function selecionarCliente(clienteId: string) {
    const cliente = clientes.find(item => item.id === clienteId)
    setForm(atual => ({
      ...atual,
      cliente_id: clienteId,
      nome_contato: cliente?.nome || atual.nome_contato,
      celular: formatarCelular(cliente?.whatsapp || atual.celular),
      email: cliente?.email || atual.email
    }))
  }

  function cancelarFormulario() {
    setForm(formVazio)
    setEditandoId(null)
    setFormAberto(false)
    setErro('')
  }

  function editar(item: Oportunidade) {
    setForm({
      cliente_id: item.cliente_id || '',
      nome_contato: item.nome_contato,
      celular: formatarCelular(item.celular),
      email: item.email || '',
      origem: item.origem,
      interesse: item.interesse || '',
      data_evento: item.data_evento || '',
      quantidade_convidados: item.quantidade_convidados?.toString() || '',
      valor_estimado: item.valor_estimado || 0,
      etapa: item.etapa,
      proximo_contato: item.proximo_contato || '',
      observacoes: item.observacoes || ''
    })
    setEditandoId(item.id)
    setFormAberto(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')

    const celular = somenteDigitos(form.celular)
    if (!form.nome_contato.trim()) return setErro('Informe o nome do contato.')
    if (celular.length < 10) return setErro('Informe o celular com DDD.')

    setSalvando(true)

    const {
      data: { user },
      error: usuarioError
    } = await supabase.auth.getUser()

    if (usuarioError || !user) {
      setErro('Sua sessão expirou. Entre novamente no ERP.')
      setSalvando(false)
      return
    }

    const { data: vinculo } = await supabase
      .from('usuarios_empresa')
      .select('empresa_id')
      .eq('usuario_id', user.id)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()

    const payload = {
      empresa_id: vinculo?.empresa_id || null,
      cliente_id: form.cliente_id || null,
      nome_contato: form.nome_contato.trim(),
      celular,
      email: form.email.trim() || null,
      origem: form.origem,
      interesse: form.interesse.trim() || null,
      data_evento: form.data_evento || null,
      quantidade_convidados: form.quantidade_convidados
        ? Number(form.quantidade_convidados)
        : null,
      valor_estimado: Number(form.valor_estimado) || 0,
      etapa: form.etapa,
      proximo_contato: form.proximo_contato || null,
      observacoes: form.observacoes.trim() || null,
      responsavel_id: user.id
    }

    const resposta = editandoId
      ? await supabase.from('oportunidades').update(payload).eq('id', editandoId)
      : await supabase.from('oportunidades').insert({
          ...payload,
          created_by: user.id
        })

    if (resposta.error) {
      setErro(resposta.error.message)
      setSalvando(false)
      return
    }

    cancelarFormulario()
    setSalvando(false)
    await carregar()
  }

  async function alterarEtapa(item: Oportunidade, novaEtapa: Etapa) {
    if (novaEtapa === item.etapa) return

    let motivoPerda = item.motivo_perda
    if (novaEtapa === 'Perdido') {
      motivoPerda = window.prompt('Qual foi o motivo da perda desta oportunidade?')?.trim() || null
      if (!motivoPerda) return
    } else {
      motivoPerda = null
    }

    setErro('')
    const { error } = await supabase
      .from('oportunidades')
      .update({ etapa: novaEtapa, motivo_perda: motivoPerda })
      .eq('id', item.id)

    if (error) {
      setErro(error.message)
      return
    }

    await carregar()
  }

  function abrirWhatsApp(celular: string) {
    const numero = somenteDigitos(celular)
    if (numero) window.open(`https://wa.me/55${numero}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-6 p-4 pb-32 md:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">COMERCIAL</p>
          <h1 className="text-3xl font-bold text-slate-900">Funil Comercial</h1>
          <p className="mt-1 text-slate-500">
            Acompanhe cada contato até o fechamento da festa.
          </p>
        </div>

        <Button
          onClick={() => {
            setForm(formVazio)
            setEditandoId(null)
            setFormAberto(true)
          }}
          className="flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Nova oportunidade
        </Button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {formAberto && (
        <Card className="border-pink-200">
          <form onSubmit={salvar} className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editandoId ? 'Editar oportunidade' : 'Nova oportunidade'}
              </h2>
              <p className="text-sm text-slate-500">
                Vincule um cliente existente ou registre os dados do novo interessado.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select label="Cliente existente" value={form.cliente_id} onChange={evento => selecionarCliente(evento.target.value)}>
                <option value="">Novo interessado</option>
                {clientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
                ))}
              </Select>

              <Input label="Nome do contato *" value={form.nome_contato} onChange={evento => setForm({ ...form, nome_contato: evento.target.value })} />
              <Input label="Celular com DDD *" inputMode="tel" placeholder="21 99999-9999" value={form.celular} onChange={evento => setForm({ ...form, celular: formatarCelular(evento.target.value) })} />
              <Input label="E-mail" type="email" value={form.email} onChange={evento => setForm({ ...form, email: evento.target.value })} />

              <Select label="Origem" value={form.origem} onChange={evento => setForm({ ...form, origem: evento.target.value })}>
                {origens.map(origem => <option key={origem}>{origem}</option>)}
              </Select>

              <Select label="Etapa" value={form.etapa} onChange={evento => setForm({ ...form, etapa: evento.target.value as Etapa })}>
                {etapas.map(etapa => <option key={etapa}>{etapa}</option>)}
              </Select>

              <Input label="Interesse / tema" placeholder="Ex.: Kit Safari para aniversário" value={form.interesse} onChange={evento => setForm({ ...form, interesse: evento.target.value })} />
              <Input label="Data prevista do evento" type="date" value={form.data_evento} onChange={evento => setForm({ ...form, data_evento: evento.target.value })} />
              <Input label="Quantidade de convidados" type="number" min="1" value={form.quantidade_convidados} onChange={evento => setForm({ ...form, quantidade_convidados: evento.target.value })} />
              <Input label="Valor estimado" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor_estimado} onChange={evento => setForm({ ...form, valor_estimado: evento.target.value })} />
              <Input label="Próximo contato" type="date" value={form.proximo_contato} onChange={evento => setForm({ ...form, proximo_contato: evento.target.value })} />
            </div>

            <Textarea label="Observações" rows={4} placeholder="Preferências, dúvidas e próximos passos..." value={form.observacoes} onChange={evento => setForm({ ...form, observacoes: evento.target.value })} />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar oportunidade'}</Button>
              <Button variant="secondary" onClick={cancelarFormulario} disabled={salvando}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex items-center gap-4">
          <span className="rounded-2xl bg-blue-50 p-3 text-blue-700"><Target size={22} /></span>
          <div><p className="text-sm text-slate-500">Em aberto</p><p className="text-2xl font-bold">{resumo.abertas}</p></div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="rounded-2xl bg-green-50 p-3 text-green-700"><TrendingUp size={22} /></span>
          <div><p className="text-sm text-slate-500">Potencial</p><p className="text-2xl font-bold">{moeda(resumo.potencial)}</p></div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="rounded-2xl bg-amber-50 p-3 text-amber-700"><Clock3 size={22} /></span>
          <div><p className="text-sm text-slate-500">Retornos pendentes</p><p className="text-2xl font-bold">{resumo.retornos}</p></div>
        </Card>
        <Card className="flex items-center gap-4">
          <span className="rounded-2xl bg-pink-50 p-3 text-pink-700"><TrendingUp size={22} /></span>
          <div><p className="text-sm text-slate-500">Conversão</p><p className="text-2xl font-bold">{resumo.conversao}%</p></div>
        </Card>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3">
        <Search size={18} className="text-slate-400" />
        <input className="w-full bg-transparent text-sm outline-none" placeholder="Buscar por contato, origem, interesse ou protocolo..." value={busca} onChange={evento => setBusca(evento.target.value)} />
      </div>

      {carregando ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Carregando oportunidades...</div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="grid min-w-[1860px] grid-cols-6 gap-4">
            {etapas.map(etapa => {
              const itens = filtradas.filter(item => item.etapa === etapa)
              const valorEtapa = itens.reduce((total, item) => total + Number(item.valor_estimado || 0), 0)

              return (
                <section key={etapa} className="rounded-3xl bg-slate-100/80 p-3">
                  <div className={`mb-3 rounded-2xl border px-3 py-3 ${corEtapa(etapa)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-bold">{etapa}</h2>
                      <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold">{itens.length}</span>
                    </div>
                    <p className="mt-1 text-xs">{moeda(valorEtapa)}</p>
                  </div>

                  <div className="space-y-3">
                    {itens.map(item => {
                      const historico = historicos.filter(linha => linha.oportunidade_id === item.id)
                      const atrasado = item.proximo_contato && item.proximo_contato <= new Date().toISOString().slice(0, 10) && !['Fechado', 'Perdido'].includes(item.etapa)

                      return (
                        <article key={item.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-pink-700">OP-{String(item.numero).padStart(4, '0')}</p>
                              <h3 className="truncate font-bold text-slate-900">{item.nome_contato}</h3>
                              <p className="truncate text-sm text-slate-500">{item.interesse || 'Interesse não informado'}</p>
                            </div>
                            <button type="button" aria-label={`Abrir WhatsApp de ${item.nome_contato}`} onClick={() => abrirWhatsApp(item.celular)} className="rounded-xl bg-green-50 p-2 text-green-700 hover:bg-green-100">
                              <MessageCircle size={17} />
                            </button>
                          </div>

                          <div className="mt-3 space-y-1 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">{moeda(item.valor_estimado)}</p>
                            <p className="flex items-center gap-1"><CalendarDays size={13} /> Evento: {dataCurta(item.data_evento)}</p>
                            <p className={atrasado ? 'font-bold text-red-600' : ''}>Retorno: {dataCurta(item.proximo_contato)}</p>
                            <p>Origem: {item.origem}</p>
                          </div>

                          {item.motivo_perda && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">Motivo: {item.motivo_perda}</p>}

                          <div className="mt-4 space-y-2">
                            <Select aria-label={`Alterar etapa de ${item.nome_contato}`} value={item.etapa} onChange={evento => alterarEtapa(item, evento.target.value as Etapa)}>
                              {etapas.map(opcao => <option key={opcao}>{opcao}</option>)}
                            </Select>

                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="secondary" className="px-3" onClick={() => editar(item)}>Editar</Button>
                              <Button variant="secondary" className="flex items-center justify-center gap-1 px-3" onClick={() => setDetalheAberto(detalheAberto === item.id ? null : item.id)}>
                                Histórico {detalheAberto === item.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </Button>
                            </div>
                          </div>

                          {detalheAberto === item.id && (
                            <div className="mt-4 border-t pt-3">
                              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Histórico</p>
                              <div className="space-y-2">
                                {historico.slice(0, 5).map(linha => (
                                  <div key={linha.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                    <p>{linha.descricao}</p>
                                    <p className="mt-1 text-[11px] text-slate-400">{new Date(linha.created_at).toLocaleString('pt-BR')}</p>
                                  </div>
                                ))}
                                {historico.length === 0 && <p className="text-xs text-slate-400">Nenhum histórico registrado.</p>}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    })}

                    {itens.length === 0 && <div className="rounded-2xl border border-dashed bg-white/60 p-6 text-center text-xs text-slate-400">Nenhuma oportunidade</div>}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
