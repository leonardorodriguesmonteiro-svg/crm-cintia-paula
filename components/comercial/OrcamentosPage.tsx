'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Ban, CalendarCheck, CheckCircle2, CircleAlert, Copy, Download, ExternalLink, FileSignature, HandCoins, Mail, Plus, Send, Share2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { criarDocumentoOrcamento, mensagemWhatsAppOrcamento, telefoneWhatsApp } from '@/lib/orcamentoPdf'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Oportunidade = {
  id: string
  numero: number
  cliente_id: string | null
  nome_contato: string
  celular: string
  email: string | null
  interesse: string | null
  data_evento: string | null
  etapa: string
  versao: number
}

type Cliente = {
  id: string
  nome: string
  whatsapp: string | null
  email: string | null
}

type Kit = {
  id: string
  codigo: string | null
  nome: string
  valor: number | null
}

type ComposicaoKit = {
  id: string
  kit_id: string
  quantidade: number
  valor_ajuste: number | null
  estoque_itens: {
    nome: string
    codigo: string | null
    categoria: string | null
  } | null
}

type AcessorioEstoque = {
  id: string
  nome: string
  codigo: string | null
  categoria: string | null
  quantidade_disponivel: number | null
}

type ItemForm = {
  chave: string
  kit_id: string
  descricao: string
  quantidade: number | string
  valor_unitario: number | string
}

type Orcamento = {
  id: string
  numero: number
  oportunidade_id: string | null
  cliente_id: string | null
  status: string
  validade: string | null
  data_evento: string | null
  horario_evento: string | null
  data_retirada: string | null
  data_devolucao: string | null
  endereco_evento: string | null
  subtotal: number
  desconto: number
  acrescimos: number
  frete: number
  total: number
  observacoes: string | null
  reserva_id: string | null
  public_token: string | null
  email_enviado_em: string | null
  email_destino: string | null
  email_erro: string | null
  resposta_cliente: 'Aprovado' | 'Recusado' | 'ACEITA' | 'RECUSADA' | null
  respondido_por: string | null
  respondido_em: string | null
  resposta_observacao: string | null
  formalizacao_status: string | null
  contrato_id: string | null
  lancamento_sinal_id: string | null
  valor_sinal_formalizacao: number | null
  vencimento_sinal: string | null
  formalizado_em: string | null
  contrato_assinado_em: string | null
  sinal_pago_em: string | null
  created_at: string
  oportunidades: {
    numero: number
    nome_contato: string
    celular: string
    email: string | null
  } | null
  clientes: {
    nome: string
    whatsapp: string | null
    email: string | null
  } | null
  contratos: {
    public_token: string | null
    email_enviado_em: string | null
    email_destino: string | null
  } | null
  lancamentos_financeiros: {
    provedor_pagamento: string | null
    link_pagamento: string | null
    status_provedor: string | null
  } | null
}

type FormOrcamento = {
  cliente_id: string
  oportunidade_id: string
  status: string
  validade: string
  data_evento: string
  horario_evento: string
  data_retirada: string
  data_devolucao: string
  endereco_evento: string
  desconto: number | string
  acrescimos: number | string
  frete: number | string
  observacoes: string
}

type Disponibilidade = {
  disponivel: boolean
  motivo: string
}

type ConversaoReserva = {
  reserva_id: string
  criada: boolean
  mensagem: string
}

type DadosDocumento = Orcamento & {
  cliente: {
    nome: string
    whatsapp: string | null
    email: string | null
  }
  itens: Array<{
    descricao: string
    quantidade: number
    valor_unitario: number
    subtotal: number
  }>
}

function dataValidadeInicial() {
  const data = new Date()
  data.setDate(data.getDate() + 7)
  return data.toISOString().slice(0, 10)
}

function dataVencimentoSinalInicial() {
  const data = new Date()
  data.setDate(data.getDate() + 2)
  return data.toISOString().slice(0, 10)
}

const formVazio: FormOrcamento = {
  cliente_id: '',
  oportunidade_id: '',
  status: 'Rascunho',
  validade: dataValidadeInicial(),
  data_evento: '',
  horario_evento: '',
  data_retirada: '',
  data_devolucao: '',
  endereco_evento: '',
  desconto: 0,
  acrescimos: 0,
  frete: 0,
  observacoes: ''
}

function novoItem(): ItemForm {
  return {
    chave: crypto.randomUUID(),
    kit_id: '',
    descricao: '',
    quantidade: 1,
    valor_unitario: 0
  }
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

function corStatus(status: string) {
  if (['Aprovado', 'ACEITA'].includes(status)) return 'bg-green-100 text-green-800'
  if (['Enviado', 'ENVIADA'].includes(status)) return 'bg-blue-100 text-blue-800'
  if (['Recusado', 'RECUSADA', 'CANCELADA'].includes(status)) return 'bg-red-100 text-red-800'
  if (['Expirado', 'EXPIRADA'].includes(status)) return 'bg-slate-200 text-slate-700'
  return 'bg-amber-100 text-amber-800'
}

function corFormalizacao(status: string | null) {
  if (status === 'Venda confirmada') return 'bg-green-100 text-green-800'
  if (status === 'Aguardando sinal') return 'bg-blue-100 text-blue-800'
  if (status === 'Aguardando contrato') return 'bg-purple-100 text-purple-800'
  if (status === 'Cancelada') return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-800'
}

function nomeClienteDo(orcamento: Orcamento) {
  return orcamento.clientes?.nome || orcamento.oportunidades?.nome_contato || 'Cliente não identificado'
}

function emailClienteDo(orcamento: Orcamento) {
  return orcamento.clientes?.email || orcamento.oportunidades?.email || null
}

function propostaPodeSerCancelada(orcamento: Orcamento) {
  return ['Enviado', 'ENVIADA'].includes(orcamento.status) && !orcamento.resposta_cliente
}

function propostaPodeSerEnviada(orcamento: Orcamento) {
  return ['Rascunho', 'RASCUNHO', 'Enviado', 'ENVIADA'].includes(orcamento.status) && !orcamento.resposta_cliente
}

function propostaPodeSerEditada(orcamento: Orcamento) {
  return ['Rascunho', 'RASCUNHO'].includes(orcamento.status) && !orcamento.resposta_cliente
}

export function OrcamentosPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [composicoesKit, setComposicoesKit] = useState<ComposicaoKit[]>([])
  const [acessorios, setAcessorios] = useState<AcessorioEstoque[]>([])
  const [buscaAcessorio, setBuscaAcessorio] = useState('')
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [form, setForm] = useState<FormOrcamento>(formVazio)
  const [itens, setItens] = useState<ItemForm[]>([novoItem()])
  const [disponibilidades, setDisponibilidades] = useState<Record<string, Disponibilidade>>({})
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [convertendoId, setConvertendoId] = useState<string | null>(null)
  const [acaoDocumento, setAcaoDocumento] = useState<string | null>(null)
  const [formalizandoId, setFormalizandoId] = useState<string | null>(null)
  const [assinandoId, setAssinandoId] = useState<string | null>(null)
  const [recebendoSinalId, setRecebendoSinalId] = useState<string | null>(null)
  const [valoresSinal, setValoresSinal] = useState<Record<string, string>>({})
  const [vencimentosSinal, setVencimentosSinal] = useState<Record<string, string>>({})
  const [formasSinal, setFormasSinal] = useState<Record<string, string>>({})
  const [gerandoCobrancaId, setGerandoCobrancaId] = useState<string | null>(null)
  const [enviandoContratoId, setEnviandoContratoId] = useState<string | null>(null)
  const [cancelandoEnvioId, setCancelandoEnvioId] = useState<string | null>(null)
  const [enviandoPropostaId, setEnviandoPropostaId] = useState<string | null>(null)
  const [cancelandoPropostaId, setCancelandoPropostaId] = useState<string | null>(null)
  const [mercadoPagoPronto, setMercadoPagoPronto] = useState(false)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    setErro('')

    const [clientesRes, oportunidadesRes, kitsRes, composicoesRes, acessoriosRes, orcamentosRes] = await Promise.all([
      supabase.from('clientes').select('id,nome,whatsapp,email').order('nome'),
      supabase
        .from('oportunidades')
        .select('id,numero,cliente_id,nome_contato,celular,email,interesse,data_evento,etapa,versao')
        .in('etapa', ['APROVADA', 'CONVERTIDA_EM_PROPOSTA', 'Novo contato', 'Em atendimento', 'Orçamento enviado', 'Negociação', 'Fechado'])
        .order('updated_at', { ascending: false }),
      supabase.from('kits').select('id,codigo,nome,valor').order('nome'),
      supabase
        .from('kit_composicao')
        .select('id,kit_id,quantidade,valor_ajuste,estoque_itens(nome,codigo,categoria)'),
      supabase
        .from('estoque_itens')
        .select('id,nome,codigo,categoria,quantidade_disponivel')
        .or('status.is.null,status.neq.Inativo')
        .order('nome'),
      supabase
        .from('orcamentos')
        .select('*,clientes(nome,whatsapp,email),oportunidades(numero,nome_contato,celular,email),contratos(public_token,email_enviado_em,email_destino),lancamentos_financeiros(provedor_pagamento,link_pagamento,status_provedor)')
        .order('created_at', { ascending: false })
    ])

    const primeiroErro = clientesRes.error || oportunidadesRes.error || kitsRes.error || composicoesRes.error || acessoriosRes.error || orcamentosRes.error

    if (primeiroErro) {
      setErro(primeiroErro.message)
    } else {
      setClientes(clientesRes.data || [])
      setOportunidades(oportunidadesRes.data || [])
      setKits(kitsRes.data || [])
      setComposicoesKit((composicoesRes.data as unknown as ComposicaoKit[]) || [])
      setAcessorios(acessoriosRes.data || [])
      setOrcamentos((orcamentosRes.data as unknown as Orcamento[]) || [])
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
    fetch('/api/pagamentos/mercado-pago/status', { cache: 'no-store' })
      .then(resposta => resposta.json())
      .then(dados => setMercadoPagoPronto(Boolean(dados.pronto)))
      .catch(() => setMercadoPagoPronto(false))
  }, [])

  useEffect(() => {
    const oportunidadeId = new URLSearchParams(window.location.search).get('oportunidade')
    if (!oportunidadeId) return

    setForm(atual => ({ ...atual, oportunidade_id: oportunidadeId }))
    setFormAberto(true)
  }, [])

  useEffect(() => {
    if (!form.oportunidade_id || form.data_evento) return

    const oportunidade = oportunidades.find(item => item.id === form.oportunidade_id)
    if (!oportunidade) return

    setForm(atual => ({
      ...atual,
      cliente_id: oportunidade.cliente_id || atual.cliente_id,
      data_evento: oportunidade.data_evento || atual.data_evento,
      data_retirada: oportunidade.data_evento || atual.data_retirada,
      data_devolucao: oportunidade.data_evento || atual.data_devolucao
    }))
  }, [form.data_evento, form.oportunidade_id, oportunidades])

  const subtotal = useMemo(
    () => itens.reduce(
      (total, item) => total + Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
      0
    ),
    [itens]
  )

  const acessoriosFiltrados = useMemo(() => {
    const termo = buscaAcessorio.trim().toLocaleLowerCase('pt-BR')
    return acessorios.filter(item =>
      [item.codigo, item.nome, item.categoria]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(termo)
    )
  }, [acessorios, buscaAcessorio])

  const total = Math.max(
    subtotal - Number(form.desconto || 0) + Number(form.acrescimos || 0) + Number(form.frete || 0),
    0
  )

  function iniciarNovo() {
    setForm({ ...formVazio, validade: dataValidadeInicial() })
    setItens([novoItem()])
    setDisponibilidades({})
    setEditandoId(null)
    setErro('')
    setSucesso('')
    setFormAberto(true)
  }

  function selecionarOportunidade(id: string) {
    const oportunidade = oportunidades.find(item => item.id === id)
    setForm(atual => ({
      ...atual,
      oportunidade_id: id,
      cliente_id: oportunidade?.cliente_id || atual.cliente_id,
      data_evento: oportunidade?.data_evento || atual.data_evento,
      data_retirada: oportunidade?.data_evento || atual.data_retirada,
      data_devolucao: oportunidade?.data_evento || atual.data_devolucao
    }))
    setDisponibilidades({})
  }

  function selecionarCliente(id: string) {
    setForm(atual => ({
      ...atual,
      cliente_id: id,
      oportunidade_id: atual.oportunidade_id && oportunidades.some(
        item => item.id === atual.oportunidade_id && item.cliente_id === id
      ) ? atual.oportunidade_id : ''
    }))
  }

  function atualizarItem(chave: string, alteracoes: Partial<ItemForm>) {
    setItens(atuais => atuais.map(item => item.chave === chave ? { ...item, ...alteracoes } : item))
    setDisponibilidades(atuais => {
      const proximo = { ...atuais }
      delete proximo[chave]
      return proximo
    })
  }

  function selecionarKit(chave: string, kitId: string) {
    const kit = kits.find(item => item.id === kitId)
    atualizarItem(chave, {
      kit_id: kitId,
      descricao: kit ? `${kit.codigo ? `${kit.codigo} - ` : ''}${kit.nome}` : '',
      valor_unitario: Number(kit?.valor || 0)
    })
  }

  function adicionarAcessorio(acessorio: AcessorioEstoque) {
    setItens(atuais => [...atuais, {
      ...novoItem(),
      descricao: `${acessorio.codigo ? `${acessorio.codigo} - ` : ''}${acessorio.nome}`
    }])
    setBuscaAcessorio('')
  }

  async function verificarDisponibilidade(item: ItemForm) {
    if (!item.kit_id) {
      const resultado = { disponivel: true, motivo: 'Item adicional sem controle de kit.' }
      setDisponibilidades(atuais => ({ ...atuais, [item.chave]: resultado }))
      return resultado
    }

    const inicio = form.data_retirada || form.data_evento
    const fim = form.data_devolucao || form.data_evento

    if (!inicio || !fim) {
      const resultado = { disponivel: false, motivo: 'Informe a data do evento ou o período.' }
      setDisponibilidades(atuais => ({ ...atuais, [item.chave]: resultado }))
      return resultado
    }

    const { data, error } = await supabase.rpc('verificar_disponibilidade_kit', {
      p_kit_id: item.kit_id,
      p_inicio: inicio,
      p_fim: fim,
      p_reserva_ignorar: null
    })

    const resultado = error
      ? { disponivel: false, motivo: error.message }
      : (data as Disponibilidade)

    setDisponibilidades(atuais => ({ ...atuais, [item.chave]: resultado }))
    return resultado
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (!form.cliente_id && !form.oportunidade_id) return setErro('Selecione o cliente deste orçamento.')
    if (!form.data_evento) return setErro('Informe a data prevista do evento.')

    const itensValidos = itens.filter(item => item.descricao.trim() && Number(item.quantidade) > 0)
    if (!itensValidos.length) return setErro('Adicione pelo menos um item ao orçamento.')

    setSalvando(true)

    for (const item of itensValidos) {
      const disponibilidade = await verificarDisponibilidade(item)
      if (!disponibilidade.disponivel) {
        setErro(`Não foi possível salvar: ${disponibilidade.motivo}`)
        setSalvando(false)
        return
      }
    }

    const {
      data: { user },
      error: usuarioError
    } = await supabase.auth.getUser()

    if (usuarioError || !user) {
      setErro('Sua sessão expirou. Entre novamente no ERP.')
      setSalvando(false)
      return
    }

    const oportunidade = oportunidades.find(item => item.id === form.oportunidade_id)
    const clienteId = form.cliente_id || oportunidade?.cliente_id || null
    const { data: vinculo } = await supabase
      .from('usuarios_empresa')
      .select('empresa_id')
      .eq('usuario_id', user.id)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()

    const novaJornada = ['APROVADA', 'CONVERTIDA_EM_PROPOSTA'].includes(oportunidade?.etapa || '')
    const desejaAprovar = form.status === 'Aprovado' && !novaJornada
    const payload = {
      empresa_id: vinculo?.empresa_id || null,
      oportunidade_id: form.oportunidade_id || null,
      cliente_id: clienteId,
      status: novaJornada ? 'RASCUNHO' : (desejaAprovar ? 'Enviado' : form.status),
      validade: form.validade || null,
      data_evento: form.data_evento,
      horario_evento: form.horario_evento || null,
      data_retirada: form.data_retirada || form.data_evento,
      data_devolucao: form.data_devolucao || form.data_evento,
      endereco_evento: form.endereco_evento.trim() || null,
      desconto: Number(form.desconto) || 0,
      acrescimos: Number(form.acrescimos) || 0,
      frete: Number(form.frete) || 0,
      observacoes: form.observacoes.trim() || null,
      created_by: user.id
    }

    let orcamentoId = editandoId

    if (editandoId) {
      const { error } = await supabase.from('orcamentos').update(payload).eq('id', editandoId)
      if (error) {
        setErro(error.message)
        setSalvando(false)
        return
      }

      const { error: limparError } = await supabase.from('orcamento_itens').delete().eq('orcamento_id', editandoId)
      if (limparError) {
        setErro(limparError.message)
        setSalvando(false)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('orcamentos')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        setErro(error.message)
        setSalvando(false)
        return
      }
      orcamentoId = data.id
    }

    const { error: itensError } = await supabase.from('orcamento_itens').insert(
      itensValidos.map(item => ({
        orcamento_id: orcamentoId,
        kit_id: item.kit_id || null,
        descricao: item.descricao.trim(),
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario) || 0
      }))
    )

    if (itensError) {
      setErro(itensError.message)
      setSalvando(false)
      return
    }

    if (desejaAprovar && orcamentoId) {
      const { data: conversao, error: conversaoError } = await supabase.rpc(
        'aprovar_orcamento_e_criar_reserva',
        { p_orcamento_id: orcamentoId }
      )

      if (conversaoError) {
        setErro(`O orçamento foi salvo, mas a reserva não foi criada: ${conversaoError.message}`)
        setSalvando(false)
        await carregar()
        return
      }

      const resultado = conversao as ConversaoReserva
      setSucesso(resultado.mensagem)
      setFormAberto(false)
      setEditandoId(null)
      setSalvando(false)
      await carregar()
      return
    }

    if (form.status === 'Enviado' && oportunidade && !['Fechado', 'Perdido'].includes(oportunidade.etapa)) {
      await supabase.from('oportunidades').update({ etapa: 'Orçamento enviado' }).eq('id', oportunidade.id)
    }

    setSucesso('Orçamento salvo e totais recalculados com sucesso.')
    setFormAberto(false)
    setEditandoId(null)
    setSalvando(false)
    await carregar()
  }

  async function aprovarECriarReserva(orcamento: Orcamento) {
    if (!window.confirm(`Aprovar o ORC-${String(orcamento.numero).padStart(4, '0')} e gerar a reserva confirmada?`)) return

    setErro('')
    setSucesso('')
    setConvertendoId(orcamento.id)

    const { data, error } = await supabase.rpc('aprovar_orcamento_e_criar_reserva', {
      p_orcamento_id: orcamento.id
    })

    if (error) {
      setErro(error.message)
      setConvertendoId(null)
      return
    }

    const resultado = data as ConversaoReserva
    setSucesso(resultado.mensagem)
    setConvertendoId(null)
    await carregar()
  }

  async function carregarDadosDocumento(orcamento: Orcamento): Promise<DadosDocumento> {
    const itensPromise = supabase
      .from('orcamento_itens')
      .select('descricao,quantidade,valor_unitario,subtotal')
      .eq('orcamento_id', orcamento.id)
      .order('created_at')

    const clientePromise = orcamento.cliente_id
      ? supabase
          .from('clientes')
          .select('nome,whatsapp,email')
          .eq('id', orcamento.cliente_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const [itensRes, clienteRes] = await Promise.all([itensPromise, clientePromise])

    if (itensRes.error) throw itensRes.error
    if (clienteRes.error) throw clienteRes.error

    return {
      ...orcamento,
      cliente: clienteRes.data || {
        nome: orcamento.oportunidades?.nome_contato || 'Cliente',
        whatsapp: orcamento.oportunidades?.celular || null,
        email: orcamento.oportunidades?.email || null
      },
      itens: (itensRes.data || []).map(item => ({
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        subtotal: Number(item.subtotal)
      }))
    }
  }

  function mensagemErroDocumento(error: unknown) {
    return error instanceof Error ? error.message : 'Não foi possível gerar o PDF.'
  }

  async function baixarPdf(orcamento: Orcamento) {
    setErro('')
    setSucesso('')
    setAcaoDocumento(`pdf:${orcamento.id}`)

    try {
      const dados = await carregarDadosDocumento(orcamento)
      const { doc, nomeArquivo } = await criarDocumentoOrcamento(dados)
      doc.save(nomeArquivo)
      setSucesso(`PDF do ORC-${String(orcamento.numero).padStart(4, '0')} gerado com sucesso.`)
    } catch (error) {
      setErro(mensagemErroDocumento(error))
    } finally {
      setAcaoDocumento(null)
    }
  }

  async function registrarEnvio(orcamento: Orcamento) {
    if (!['Rascunho', 'RASCUNHO'].includes(orcamento.status)) return

    if (orcamento.status === 'RASCUNHO') {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

      const resposta = await fetch(`/api/comercial/propostas/${orcamento.id}/enviar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const dados = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível enviar a proposta.')
      await carregar()
      return
    }

    const { error: orcamentoError } = await supabase
      .from('orcamentos')
      .update({ status: 'Enviado' })
      .eq('id', orcamento.id)

    if (orcamentoError) throw orcamentoError

    if (orcamento.oportunidade_id) {
      const { error: oportunidadeError } = await supabase
        .from('oportunidades')
        .update({ etapa: 'Orçamento enviado' })
        .eq('id', orcamento.oportunidade_id)
        .in('etapa', ['Novo contato', 'Em atendimento', 'Orçamento enviado', 'Negociação'])

      if (oportunidadeError) throw oportunidadeError
    }

    await carregar()
  }

  async function compartilharPdf(orcamento: Orcamento) {
    setErro('')
    setSucesso('')
    setAcaoDocumento(`compartilhar:${orcamento.id}`)

    try {
      const dados = await carregarDadosDocumento(orcamento)
      const { doc, nomeArquivo } = await criarDocumentoOrcamento(dados)
      const link_publico = orcamento.public_token
        ? `${window.location.origin}/proposta/${orcamento.public_token}`
        : null
      const mensagem = mensagemWhatsAppOrcamento({ ...dados, link_publico })
      const arquivo = new File([doc.output('blob')], nomeArquivo, { type: 'application/pdf' })
      const podeCompartilharArquivo = Boolean(
        navigator.share && navigator.canShare?.({ files: [arquivo] })
      )

      if (podeCompartilharArquivo) {
        await navigator.share({
          title: `Orçamento ORC-${String(orcamento.numero).padStart(4, '0')}`,
          text: mensagem,
          files: [arquivo]
        })
        setSucesso('PDF compartilhado com sucesso.')
      } else {
        doc.save(nomeArquivo)
        const numero = telefoneWhatsApp(dados.cliente.whatsapp)
        const destino = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
        const janela = window.open(destino, '_blank', 'noopener,noreferrer')

        if (!janela) window.location.assign(destino)
        setSucesso('PDF baixado. Anexe o arquivo à conversa aberta no WhatsApp.')
      }

      await registrarEnvio(orcamento)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setErro(mensagemErroDocumento(error))
    } finally {
      setAcaoDocumento(null)
    }
  }

  async function copiarLinkPublico(orcamento: Orcamento) {
    setErro('')
    setSucesso('')

    if (!orcamento.public_token) {
      setErro('Este orçamento ainda não possui um link público.')
      return
    }

    try {
      await registrarEnvio(orcamento)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível liberar a proposta para envio.')
      return
    }

    const link = `${window.location.origin}/proposta/${orcamento.public_token}`
    let copiado = false

    try {
      await navigator.clipboard.writeText(link)
      copiado = true
    } catch {
      const campo = document.createElement('textarea')
      campo.value = link
      campo.setAttribute('readonly', '')
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      campo.setSelectionRange(0, campo.value.length)
      copiado = document.execCommand('copy')
      document.body.removeChild(campo)
    }

    if (copiado) {
      setSucesso(`Link público do ORC-${String(orcamento.numero).padStart(4, '0')} copiado.`)
    } else {
      setErro('Não foi possível copiar o link. Abra a proposta e copie o endereço do navegador.')
    }
  }

  async function enviarPropostaPorEmail(orcamento: Orcamento) {
    const email = orcamento.clientes?.email || orcamento.oportunidades?.email
    if (!email) {
      setErro('Cadastre um e-mail para o cliente antes de enviar a proposta.')
      return
    }

    setErro('')
    setSucesso('')
    setEnviandoPropostaId(orcamento.id)

    try {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

      const resposta = await fetch(`/api/orcamentos/${orcamento.id}/enviar-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reenviar: Boolean(orcamento.email_enviado_em) })
      })
      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível enviar a proposta.')

      setSucesso(corpo.mensagem || `Proposta enviada para ${email}.`)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar a proposta.')
    } finally {
      setEnviandoPropostaId(null)
    }
  }

  async function cancelarEnvioProposta(orcamento: Orcamento) {
    if (!window.confirm('Cancelar este envio? O e-mail continuará na caixa do cliente, mas o link da proposta será invalidado.')) return

    setErro('')
    setSucesso('')
    setCancelandoPropostaId(orcamento.id)

    try {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

      const resposta = await fetch(`/api/orcamentos/${orcamento.id}/cancelar-envio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível cancelar o envio.')

      setSucesso(corpo.mensagem)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível cancelar o envio.')
    } finally {
      setCancelandoPropostaId(null)
    }
  }

  async function copiarLinkContrato(orcamento: Orcamento) {
    setErro('')
    setSucesso('')

    if (!orcamento.contratos?.public_token) {
      setErro('Este contrato ainda não possui um link de assinatura.')
      return
    }

    const link = `${window.location.origin}/contrato/${orcamento.contratos.public_token}`
    let copiado = false

    try {
      await navigator.clipboard.writeText(link)
      copiado = true
    } catch {
      const campo = document.createElement('textarea')
      campo.value = link
      campo.setAttribute('readonly', '')
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      campo.setSelectionRange(0, campo.value.length)
      copiado = document.execCommand('copy')
      document.body.removeChild(campo)
    }

    if (copiado) {
      setSucesso(`Link de assinatura do ${orcamento.contrato_id ? 'contrato' : 'orçamento'} copiado.`)
    } else {
      setErro('Não foi possível copiar o link. Abra a página do cliente e copie o endereço.')
    }
  }

  async function enviarContratoPorEmail(orcamento: Orcamento) {
    if (!orcamento.contrato_id) return

    setErro('')
    setSucesso('')
    setEnviandoContratoId(orcamento.id)

    try {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

      const resposta = await fetch(`/api/contratos/${orcamento.contrato_id}/enviar-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reenviar: true })
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível enviar o contrato.')

      setSucesso(corpo.mensagem || 'Boas-vindas e contrato enviados por e-mail.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar o contrato.')
    } finally {
      setEnviandoContratoId(null)
    }
  }

  async function cancelarEnvioContrato(orcamento: Orcamento) {
    if (!orcamento.contrato_id) return
    if (!confirm('Cancelar este envio? O e-mail continuará na caixa do cliente, mas o link de assinatura será invalidado.')) return

    setErro('')
    setSucesso('')
    setCancelandoEnvioId(orcamento.id)

    try {
      const { data: sessao } = await supabase.auth.getSession()
      const token = sessao.session?.access_token
      if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

      const resposta = await fetch(`/api/contratos/${orcamento.contrato_id}/cancelar-envio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível cancelar o envio.')

      setSucesso(corpo.mensagem)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível cancelar o envio.')
    } finally {
      setCancelandoEnvioId(null)
    }
  }

  function valorSinalDo(orcamento: Orcamento) {
    return valoresSinal[orcamento.id]
      ?? String(orcamento.valor_sinal_formalizacao || Math.max(orcamento.total * 0.3, 1).toFixed(2))
  }

  function vencimentoSinalDo(orcamento: Orcamento) {
    return vencimentosSinal[orcamento.id]
      ?? orcamento.vencimento_sinal
      ?? dataVencimentoSinalInicial()
  }

  async function executarFormalizacao(
    orcamentoId: string,
    acao: 'formalizar' | 'confirmar_assinatura' | 'confirmar_sinal',
    dados: Record<string, unknown> = {}
  ) {
    const { data: sessao } = await supabase.auth.getSession()
    const token = sessao.session?.access_token
    if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

    const resposta = await fetch(`/api/orcamentos/${orcamentoId}/formalizacao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ acao, ...dados })
    })
    const corpo = await resposta.json()
    if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível concluir a formalização.')
    return corpo
  }

  async function formalizarVenda(orcamento: Orcamento) {
    setErro('')
    setSucesso('')
    setFormalizandoId(orcamento.id)

    try {
      const data = await executarFormalizacao(orcamento.id, 'formalizar', {
        valor_sinal: Number(valorSinalDo(orcamento)),
        vencimento: vencimentoSinalDo(orcamento)
      })
      let mensagem = data?.mensagem || 'Venda formalizada com sucesso.'

      if (mercadoPagoPronto) {
        try {
          const cobranca = await solicitarCobrancaMercadoPago(orcamento.id)
          if (cobranca?.sucesso) mensagem += ' Cobrança do Mercado Pago criada.'
        } catch {
          mensagem += ' A venda foi criada, mas a cobrança do Mercado Pago precisa ser tentada novamente.'
        }
      }

      if (data?.contrato_id) mensagem += ' Revise os dados e use o botão de envio quando estiver pronto.'

      setSucesso(mensagem)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível formalizar a venda.')
    }

    setFormalizandoId(null)
  }

  async function solicitarCobrancaMercadoPago(orcamentoId: string, forcar = false) {
    const { data: sessao } = await supabase.auth.getSession()
    const token = sessao.session?.access_token
    if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

    const resposta = await fetch('/api/pagamentos/mercado-pago/preferencia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ orcamento_id: orcamentoId, forcar })
    })
    const corpo = await resposta.json()
    if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível gerar a cobrança do Mercado Pago.')
    return corpo
  }

  async function gerarCobrancaMercadoPago(orcamento: Orcamento, forcar = false) {
    setErro('')
    setSucesso('')
    setGerandoCobrancaId(orcamento.id)

    try {
      const corpo = await solicitarCobrancaMercadoPago(orcamento.id, forcar)
      setSucesso(corpo.mensagem || 'Cobrança do Mercado Pago disponível.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar a cobrança do Mercado Pago.')
    } finally {
      setGerandoCobrancaId(null)
    }
  }

  async function confirmarAssinatura(orcamento: Orcamento) {
    if (!window.confirm('Confirmar que o contrato foi assinado pelo cliente?')) return

    setErro('')
    setSucesso('')
    setAssinandoId(orcamento.id)

    try {
      const data = await executarFormalizacao(orcamento.id, 'confirmar_assinatura')
      setSucesso(data?.mensagem || 'Assinatura confirmada.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível confirmar a assinatura.')
    }

    setAssinandoId(null)
  }

  async function confirmarSinal(orcamento: Orcamento) {
    if (!window.confirm(`Confirmar o recebimento de ${moeda(orcamento.valor_sinal_formalizacao || 0)}?`)) return

    setErro('')
    setSucesso('')
    setRecebendoSinalId(orcamento.id)

    try {
      const data = await executarFormalizacao(orcamento.id, 'confirmar_sinal', {
        forma_pagamento: formasSinal[orcamento.id] || 'Pix'
      })
      setSucesso(data?.mensagem || 'Pagamento do sinal confirmado.')
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível confirmar o sinal.')
    }

    setRecebendoSinalId(null)
  }

  async function editar(orcamento: Orcamento) {
    setErro('')
    const { data, error } = await supabase
      .from('orcamento_itens')
      .select('id,kit_id,descricao,quantidade,valor_unitario')
      .eq('orcamento_id', orcamento.id)
      .order('created_at')

    if (error) return setErro(error.message)

    setForm({
      cliente_id: orcamento.cliente_id || '',
      oportunidade_id: orcamento.oportunidade_id || '',
      status: orcamento.status,
      validade: orcamento.validade || '',
      data_evento: orcamento.data_evento || '',
      horario_evento: orcamento.horario_evento || '',
      data_retirada: orcamento.data_retirada || '',
      data_devolucao: orcamento.data_devolucao || '',
      endereco_evento: orcamento.endereco_evento || '',
      desconto: orcamento.desconto || 0,
      acrescimos: orcamento.acrescimos || 0,
      frete: orcamento.frete || 0,
      observacoes: orcamento.observacoes || ''
    })
    setItens((data || []).map(item => ({
      chave: item.id,
      kit_id: item.kit_id || '',
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario
    })))
    setDisponibilidades({})
    setEditandoId(orcamento.id)
    setFormAberto(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 p-4 pb-32 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">COMERCIAL</p>
          <h1 className="text-3xl font-bold text-slate-900">Orçamentos</h1>
          <p className="mt-1 text-slate-500">Monte propostas com kits, adicionais e disponibilidade conferida.</p>
        </div>
        <Button onClick={iniciarNovo} className="flex items-center justify-center gap-2"><Plus size={18} /> Novo orçamento</Button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      {formAberto && (
        <Card className="border-pink-200">
          <form onSubmit={salvar} className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{editandoId ? 'Editar orçamento' : 'Novo orçamento'}</h2>
              <p className="text-sm text-slate-500">Defina o cliente, a pré-reserva quando existir, o período e os itens da proposta.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <Select label="Cliente *" value={form.cliente_id} onChange={evento => selecionarCliente(evento.target.value)}>
                  <option value="">Selecione um cliente...</option>
                  {clientes.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.nome}{item.email ? ` — ${item.email}` : ''}
                    </option>
                  ))}
                </Select>
                <Link href="/clientes" className="mt-1 inline-block text-xs font-semibold text-pink-700 hover:text-pink-800">
                  + Cadastrar novo cliente
                </Link>
              </div>
              <div>
                <Select label="Pré-reserva aprovada (opcional)" value={form.oportunidade_id} onChange={evento => selecionarOportunidade(evento.target.value)}>
                  <option value="">Orçamento direto para o cliente</option>
                  {oportunidades
                    .filter(item => !form.cliente_id || !item.cliente_id || item.cliente_id === form.cliente_id)
                    .filter(item => item.etapa !== 'CONVERTIDA_EM_PROPOSTA' || item.id === form.oportunidade_id)
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        PRÉ-{String(item.numero).padStart(4, '0')} — {item.nome_contato}
                      </option>
                    ))}
                </Select>
                <p className="mt-1 text-xs text-slate-500">Use quando o pedido veio do site ou da esteira comercial.</p>
              </div>
              <Select label="Status" value={form.status} onChange={evento => setForm({ ...form, status: evento.target.value })}>
                <option>Rascunho</option><option>Enviado</option><option>Aprovado</option><option>Recusado</option><option>Expirado</option>
              </Select>
              <Input label="Validade" type="date" value={form.validade} onChange={evento => setForm({ ...form, validade: evento.target.value })} />
              <Input label="Data do evento *" type="date" value={form.data_evento} onChange={evento => { setForm({ ...form, data_evento: evento.target.value }); setDisponibilidades({}) }} />
              <Input label="Horário" placeholder="Ex.: 14:00" value={form.horario_evento} onChange={evento => setForm({ ...form, horario_evento: evento.target.value })} />
              <Input label="Endereço do evento" value={form.endereco_evento} onChange={evento => setForm({ ...form, endereco_evento: evento.target.value })} />
              <Input label="Data de retirada" type="date" value={form.data_retirada} onChange={evento => { setForm({ ...form, data_retirada: evento.target.value }); setDisponibilidades({}) }} />
              <Input label="Data de devolução" type="date" value={form.data_devolucao} onChange={evento => { setForm({ ...form, data_devolucao: evento.target.value }); setDisponibilidades({}) }} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="font-bold text-slate-900">Itens da proposta</h3><p className="text-sm text-slate-500">Selecione um kit principal ou inclua acessórios decorativos do estoque.</p></div>
                <Button variant="secondary" onClick={() => setItens(atuais => [...atuais, novoItem()])}><Plus size={16} className="inline" /> Adicionar item</Button>
              </div>

              <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-4">
                <div className="mb-3">
                  <h4 className="font-semibold text-slate-900">Acessórios decorativos disponíveis</h4>
                  <p className="text-xs text-slate-500">Pesquise tapetes, vasos, flores, bandejas, cilindros e outros itens para adicionar à proposta.</p>
                </div>
                <Input
                  aria-label="Buscar acessório decorativo"
                  placeholder="Buscar por nome, código ou categoria..."
                  value={buscaAcessorio}
                  onChange={evento => setBuscaAcessorio(evento.target.value)}
                />
                <div className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border bg-white p-2">
                  {acessoriosFiltrados.map(acessorio => (
                    <button
                      key={acessorio.id}
                      type="button"
                      onClick={() => adicionarAcessorio(acessorio)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span><strong>{acessorio.nome}</strong>{acessorio.categoria ? ` · ${acessorio.categoria}` : ''}</span>
                      <span className="shrink-0 text-xs text-slate-500">Disponível: {acessorio.quantidade_disponivel || 0} · Adicionar +</span>
                    </button>
                  ))}
                  {acessoriosFiltrados.length === 0 && <p className="px-3 py-4 text-center text-sm text-slate-500">Nenhum acessório encontrado.</p>}
                </div>
              </div>

              {itens.map((item, indice) => {
                const disponibilidade = disponibilidades[item.chave]
                const composicaoSelecionada = composicoesKit
                  .filter(linha => linha.kit_id === item.kit_id)
                  .sort((a, b) => (a.estoque_itens?.nome || '').localeCompare(b.estoque_itens?.nome || '', 'pt-BR'))
                return (
                  <div key={item.chave} className="rounded-2xl border bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <Select label="Kit ou pacote principal (opcional)" className="xl:col-span-2" value={item.kit_id} onChange={evento => selecionarKit(item.chave, evento.target.value)}>
                        <option value="">Item adicional</option>
                        {kits.map(kit => <option key={kit.id} value={kit.id}>{kit.codigo ? `${kit.codigo} - ` : ''}{kit.nome}</option>)}
                      </Select>
                      <Input label="Descrição do item / acessório *" className="xl:col-span-2" value={item.descricao} onChange={evento => atualizarItem(item.chave, { descricao: evento.target.value })} />
                      <Input label="Quantidade" type="number" min="0.01" step="0.01" value={item.quantidade} onChange={evento => atualizarItem(item.chave, { quantidade: evento.target.value })} />
                      <Input label="Valor unitário" type="number" min="0" step="0.01" value={item.valor_unitario} onChange={evento => atualizarItem(item.chave, { valor_unitario: evento.target.value })} />
                    </div>
                    {item.kit_id && (
                      <div className="mt-3 rounded-xl border bg-white p-3">
                        <p className="text-xs font-bold uppercase text-slate-500">Composição incluída neste kit</p>
                        <div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm">
                          {composicaoSelecionada.map(linha => (
                            <p key={linha.id} className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                              <span>{linha.estoque_itens?.nome || 'Item'}{linha.estoque_itens?.codigo ? ` · ${linha.estoque_itens.codigo}` : ''}</span>
                              <span className="shrink-0 text-slate-500">Qtd.: {linha.quantidade}{Number(linha.valor_ajuste || 0) !== 0 ? ` · ${Number(linha.valor_ajuste || 0) > 0 ? '+' : ''}${moeda(linha.valor_ajuste || 0)}` : ''}</span>
                            </p>
                          ))}
                          {composicaoSelecionada.length === 0 && <p className="text-slate-500">Este kit ainda não possui itens de composição cadastrados.</p>}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">Subtotal: {moeda(Number(item.quantidade || 0) * Number(item.valor_unitario || 0))}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {disponibilidade && (
                          <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${disponibilidade.disponivel ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {disponibilidade.disponivel ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}{disponibilidade.motivo}
                          </span>
                        )}
                        {item.kit_id && <Button variant="secondary" onClick={() => verificarDisponibilidade(item)}><CalendarCheck size={16} className="inline" /> Ver disponibilidade</Button>}
                        {itens.length > 1 && <Button variant="danger" aria-label={`Remover item ${indice + 1}`} onClick={() => setItens(atuais => atuais.filter(linha => linha.chave !== item.chave))}><Trash2 size={16} /></Button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Textarea label="Observações da proposta" rows={6} value={form.observacoes} onChange={evento => setForm({ ...form, observacoes: evento.target.value })} />
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <h3 className="font-bold">Resumo financeiro</h3>
                <div className="mt-4 space-y-3">
                  <p className="flex justify-between text-sm text-slate-300"><span>Subtotal</span><strong>{moeda(subtotal)}</strong></p>
                  <Input label="Desconto" type="number" min="0" step="0.01" className="bg-white text-slate-900" value={form.desconto} onChange={evento => setForm({ ...form, desconto: evento.target.value })} />
                  <Input label="Acréscimos" type="number" min="0" step="0.01" className="bg-white text-slate-900" value={form.acrescimos} onChange={evento => setForm({ ...form, acrescimos: evento.target.value })} />
                  <Input label="Frete / entrega" type="number" min="0" step="0.01" className="bg-white text-slate-900" value={form.frete} onChange={evento => setForm({ ...form, frete: evento.target.value })} />
                  <div className="border-t border-slate-700 pt-4"><p className="flex items-end justify-between"><span>Total</span><strong className="text-2xl text-pink-300">{moeda(total)}</strong></p></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={salvando} className="flex items-center justify-center gap-2"><Send size={17} /> {salvando ? 'Salvando...' : 'Salvar orçamento'}</Button>
              <Button variant="secondary" onClick={() => { setFormAberto(false); setEditandoId(null); setErro('') }}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orcamentos.map(orcamento => (
          <Card key={orcamento.id}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-pink-700">ORC-{String(orcamento.numero).padStart(4, '0')}</p><h2 className="font-bold text-slate-900">{nomeClienteDo(orcamento)}</h2></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${corStatus(orcamento.status)}`}>{orcamento.status}</span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-slate-500">
              <p>Evento: {dataCurta(orcamento.data_evento)}</p><p>Validade: {dataCurta(orcamento.validade)}</p><p className="pt-2 text-xl font-bold text-slate-900">{moeda(orcamento.total)}</p>
            </div>
            {orcamento.email_enviado_em && (
              <p className="mt-3 text-xs text-slate-500">
                E-mail enviado em {new Date(orcamento.email_enviado_em).toLocaleString('pt-BR')} para {orcamento.email_destino || emailClienteDo(orcamento)}
              </p>
            )}
            {orcamento.resposta_cliente && (
              <div className={`mt-4 rounded-xl px-3 py-2 text-xs ${['Aprovado', 'ACEITA'].includes(orcamento.resposta_cliente) ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                <p className="font-bold">Cliente {['Aprovado', 'ACEITA'].includes(orcamento.resposta_cliente) ? 'aceitou' : 'recusou'} a proposta</p>
                <p className="mt-0.5">{orcamento.respondido_por || 'Cliente'} · {orcamento.respondido_em ? new Date(orcamento.respondido_em).toLocaleString('pt-BR') : 'data não informada'}</p>
                {orcamento.resposta_observacao && <p className="mt-1">“{orcamento.resposta_observacao}”</p>}
              </div>
            )}
            {orcamento.status === 'Aprovado' && (
              <div className="mt-4 rounded-2xl border border-pink-100 bg-pink-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-pink-700">Formalização da venda</p>
                    <p className="mt-0.5 text-xs text-slate-500">Reserva, contrato e cobrança do sinal em um só fluxo.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${corFormalizacao(orcamento.formalizacao_status)}`}>
                    {orcamento.formalizacao_status || 'Aguardando formalização'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                  {[
                    { rotulo: 'Cliente aprovou', concluido: true },
                    { rotulo: 'Reserva criada', concluido: Boolean(orcamento.reserva_id) },
                    { rotulo: 'Contrato assinado', concluido: Boolean(orcamento.contrato_assinado_em) },
                    { rotulo: 'Sinal recebido', concluido: Boolean(orcamento.sinal_pago_em) }
                  ].map(etapa => (
                    <div key={etapa.rotulo} className={`rounded-xl border p-2 ${etapa.concluido ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-white text-slate-500'}`}>
                      <p className="flex items-center gap-1 font-semibold">{etapa.concluido ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}{etapa.rotulo}</p>
                    </div>
                  ))}
                </div>

                {!orcamento.contrato_id ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="Valor do sinal"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={valorSinalDo(orcamento)}
                        onChange={evento => setValoresSinal(atuais => ({ ...atuais, [orcamento.id]: evento.target.value }))}
                      />
                      <Input
                        label="Vencimento do sinal"
                        type="date"
                        value={vencimentoSinalDo(orcamento)}
                        onChange={evento => setVencimentosSinal(atuais => ({ ...atuais, [orcamento.id]: evento.target.value }))}
                      />
                    </div>
                    <Button
                      disabled={formalizandoId === orcamento.id}
                      className="flex w-full items-center justify-center gap-2"
                      onClick={() => formalizarVenda(orcamento)}
                    >
                      <FileSignature size={17} />
                      {formalizandoId === orcamento.id ? 'Formalizando...' : 'Gerar reserva, contrato e cobrança'}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {orcamento.reserva_id && <Link href={`/reservas/${orcamento.reserva_id}`} className="rounded-xl border bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50">Abrir reserva</Link>}
                      <a href={`/contratos/${orcamento.contrato_id}/imprimir`} target="_blank" rel="noreferrer" className="rounded-xl border bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50">Abrir contrato</a>
                    </div>

                    {orcamento.contratos?.public_token && !orcamento.contrato_assinado_em && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                          className="flex items-center justify-center gap-1 px-2 text-xs"
                          disabled={enviandoContratoId === orcamento.id}
                          onClick={() => enviarContratoPorEmail(orcamento)}
                        >
                          <Mail size={15} />
                          {enviandoContratoId === orcamento.id
                            ? 'Enviando...'
                            : orcamento.contratos.email_enviado_em
                              ? 'Reenviar e-mail e contrato'
                              : 'Enviar e-mail e contrato'}
                        </Button>
                        {orcamento.contratos.email_enviado_em && (
                          <Button
                            variant="secondary"
                            className="flex items-center justify-center gap-1 border-red-200 px-2 text-xs text-red-700"
                            disabled={cancelandoEnvioId === orcamento.id}
                            onClick={() => cancelarEnvioContrato(orcamento)}
                          >
                            <Ban size={15} />
                            {cancelandoEnvioId === orcamento.id ? 'Cancelando...' : 'Cancelar envio e link'}
                          </Button>
                        )}
                        <Button variant="secondary" className="flex items-center justify-center gap-1 px-2 text-xs" onClick={() => copiarLinkContrato(orcamento)}><Copy size={15} /> Copiar link de assinatura</Button>
                        <a href={`/contrato/${orcamento.contratos.public_token}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl border border-pink-200 bg-pink-50 px-2 py-2 text-xs font-semibold text-pink-700 hover:bg-pink-100"><ExternalLink size={15} /> Página do cliente</a>
                      </div>
                    )}

                    {!orcamento.sinal_pago_em && (
                      mercadoPagoPronto ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {orcamento.lancamentos_financeiros?.link_pagamento && <a href={orcamento.lancamentos_financeiros.link_pagamento} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100"><ExternalLink size={15} /> Abrir Mercado Pago</a>}
                          <Button variant="secondary" disabled={gerandoCobrancaId === orcamento.id} className="flex items-center justify-center gap-1 px-2 text-xs" onClick={() => gerarCobrancaMercadoPago(orcamento, Boolean(orcamento.lancamentos_financeiros?.link_pagamento))}><HandCoins size={15} /> {gerandoCobrancaId === orcamento.id ? 'Gerando...' : orcamento.lancamentos_financeiros?.link_pagamento ? 'Renovar cobrança' : 'Gerar Mercado Pago'}</Button>
                        </div>
                      ) : (
                        <Link href="/configuracoes" className="block rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800">Conecte o Mercado Pago em Configurações</Link>
                      )
                    )}

                    {!orcamento.contrato_assinado_em ? (
                      <Button
                        variant="secondary"
                        disabled={assinandoId === orcamento.id}
                        className="flex w-full items-center justify-center gap-2"
                        onClick={() => confirmarAssinatura(orcamento)}
                      >
                        <FileSignature size={16} /> {assinandoId === orcamento.id ? 'Confirmando...' : 'Confirmar contrato assinado'}
                      </Button>
                    ) : (
                      <p className="rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">Contrato assinado em {new Date(orcamento.contrato_assinado_em).toLocaleString('pt-BR')}.</p>
                    )}

                    {!orcamento.sinal_pago_em ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                        <Select
                          label={`Forma do sinal · ${moeda(orcamento.valor_sinal_formalizacao || 0)}`}
                          value={formasSinal[orcamento.id] || 'Pix'}
                          onChange={evento => setFormasSinal(atuais => ({ ...atuais, [orcamento.id]: evento.target.value }))}
                        >
                          <option>Pix</option><option>Cartão</option><option>Dinheiro</option><option>Transferência</option><option>Boleto</option>
                        </Select>
                        <Button
                          disabled={recebendoSinalId === orcamento.id}
                          className="flex items-center justify-center gap-2 self-end"
                          onClick={() => confirmarSinal(orcamento)}
                        >
                          <HandCoins size={16} /> {recebendoSinalId === orcamento.id ? 'Confirmando...' : 'Confirmar sinal'}
                        </Button>
                      </div>
                    ) : (
                      <p className="rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">Sinal recebido em {new Date(orcamento.sinal_pago_em).toLocaleString('pt-BR')}.</p>
                    )}

                    {orcamento.formalizacao_status === 'Venda confirmada' && (
                      <p className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-bold text-white">Venda confirmada e pronta para a operação.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  disabled={acaoDocumento !== null}
                  className="flex items-center justify-center gap-1 px-2"
                  onClick={() => baixarPdf(orcamento)}
                >
                  <Download size={16} />
                  {acaoDocumento === `pdf:${orcamento.id}` ? 'Gerando...' : 'Baixar PDF'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={acaoDocumento !== null}
                  className="flex items-center justify-center gap-1 px-2"
                  onClick={() => compartilharPdf(orcamento)}
                >
                  <Share2 size={16} />
                  {acaoDocumento === `compartilhar:${orcamento.id}` ? 'Preparando...' : 'Compartilhar'}
                </Button>
              </div>
              <button
                type="button"
                disabled={!orcamento.public_token}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => copiarLinkPublico(orcamento)}
              >
                <Copy size={17} /> Copiar link da proposta
              </button>
              {!emailClienteDo(orcamento) && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Cadastre o e-mail do cliente para habilitar o envio automático.</p>
              )}
              <button
                type="button"
                disabled={enviandoPropostaId === orcamento.id || !emailClienteDo(orcamento) || !propostaPodeSerEnviada(orcamento)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => enviarPropostaPorEmail(orcamento)}
              >
                <Mail size={17} />
                {enviandoPropostaId === orcamento.id
                  ? 'Enviando...'
                  : orcamento.email_enviado_em
                    ? 'Reenviar proposta por e-mail'
                    : 'Enviar proposta por e-mail'}
              </button>
              {propostaPodeSerCancelada(orcamento) && (
                <button
                  type="button"
                  disabled={cancelandoPropostaId === orcamento.id}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => cancelarEnvioProposta(orcamento)}
                >
                  <Ban size={17} /> {cancelandoPropostaId === orcamento.id ? 'Cancelando...' : 'Cancelar envio e invalidar link'}
                </button>
              )}
              {orcamento.public_token ? (
                <a
                  href={`/proposta/${orcamento.public_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm font-bold text-pink-700 transition hover:bg-pink-100"
                >
                  <ExternalLink size={17} /> Abrir página do cliente
                </a>
              ) : (
                <span className="flex items-center justify-center rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-400">Página do cliente indisponível</span>
              )}
              {orcamento.reserva_id ? (
                <Link
                  href={`/reservas/${orcamento.reserva_id}`}
                  className="rounded-xl bg-pink-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-pink-700"
                >
                  Abrir reserva gerada
                </Link>
              ) : orcamento.status === 'Enviado' ? (
                <Button
                  disabled={convertendoId === orcamento.id}
                  onClick={() => aprovarECriarReserva(orcamento)}
                >
                  {convertendoId === orcamento.id ? 'Gerando reserva...' : 'Aprovar e gerar reserva'}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                disabled={!propostaPodeSerEditada(orcamento)}
                onClick={() => editar(orcamento)}
              >
                {propostaPodeSerEditada(orcamento)
                  ? 'Editar orçamento'
                  : orcamento.resposta_cliente
                    ? 'Proposta respondida'
                    : ['Enviado', 'ENVIADA'].includes(orcamento.status)
                      ? 'Cancele o envio para editar'
                      : 'Edição indisponível'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {!carregando && orcamentos.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">Nenhum orçamento cadastrado.</div>}
      {carregando && <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Carregando orçamentos...</div>}
    </div>
  )
}
