'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { origemPublicaJornada, ORIGEM_PUBLICA_PRODUCAO } from '@/lib/origemPublicaJornada'
import { propostaPodeEnviar } from '@/lib/domain/comercial/propostaPublica'
import { calcularEditor, serializarEditor, validarEditor, tiposTaxa, type ItemEditor, type TaxaEditor } from '@/lib/comercial/orcamentoEditor'
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
  cadastro_completo_em: string | null
  desconto_tipo: 'VALOR' | 'PERCENTUAL'
  desconto_valor: number
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

type AcessorioEstoque = {
  id: string
  nome: string
  codigo: string | null
  categoria: string | null
  valor_locacao: number | null
  quantidade_disponivel: number | null
}

type ItemForm = ItemEditor

type ItemConceitual = { id: string; nome: string; preco_locacao_estimado: number | null }

type Orcamento = {
  id: string
  empresa_id: string | null
  versao: number
  origem: string
  contato_nome: string | null
  contato_telefone: string | null
  contato_email: string | null
  tema_evento: string | null
  desconto_tipo: 'VALOR' | 'PERCENTUAL'
  desconto_valor: number
  total_taxas: number
  numero: number
  oportunidade_id: string | null
  cliente_id: string | null
  status: string
  validade: string | null
  data_evento: string | null
  horario_evento: string | null
  data_retirada: string | null
  horario_retirada: string | null
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
  resposta_cliente: 'ACEITA' | 'RECUSADA' | null
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
    cadastro_completo_em: string | null
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
  contato_nome: string
  contato_telefone: string
  contato_email: string
  tema_evento: string
  origem: string
  validade: string
  data_evento: string
  horario_evento: string
  data_retirada: string
  horario_retirada: string
  data_devolucao: string
  endereco_evento: string
  desconto: number | string
  observacoes: string
}

type Disponibilidade = {
  disponivel: boolean
  motivo: string
}

type DadosDocumento = Orcamento & {
  empresa: {
    nome: string
    nome_fantasia: string | null
    razao_social: string | null
    cnpj: string | null
    email: string | null
    telefone: string | null
    whatsapp: string | null
    site: string | null
    logradouro: string | null
    numero: string | null
    complemento: string | null
    bairro: string | null
    cidade: string | null
    estado: string | null
    cep: string | null
    logo_url: string | null
  }
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
  status: 'EM_EDICAO',
  contato_nome: '', contato_telefone: '', contato_email: '', tema_evento: '', origem: 'MANUAL',
  validade: dataValidadeInicial(),
  data_evento: '',
  horario_evento: '',
  data_retirada: '',
  horario_retirada: '',
  data_devolucao: '',
  endereco_evento: '',
  desconto: 0,
  observacoes: ''
}

function novoItem(): ItemForm {
  return {
    chave: crypto.randomUUID(),
    kit_id: '',
    estoque_item_id: '',
    item_conceitual_id: '', tipo_origem: 'LIVRE', preco_base: null, desconto: 0, observacao: '',
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
  if (status === 'FINALIZADO') return 'bg-green-100 text-green-800'
  if (status === 'ACEITA') return 'bg-green-100 text-green-800'
  if (status === 'ENVIADA') return 'bg-blue-100 text-blue-800'
  if (['RECUSADA', 'CANCELADA'].includes(status)) return 'bg-red-100 text-red-800'
  if (status === 'EXPIRADA') return 'bg-slate-200 text-slate-700'
  return 'bg-amber-100 text-amber-800'
}

function corFormalizacao(status: string | null) {
  if (status === 'Venda confirmada' || status === 'RESERVA_CONFIRMADA') return 'bg-green-100 text-green-800'
  if (status === 'Aguardando sinal' || status === 'AGUARDANDO_PAGAMENTO') return 'bg-blue-100 text-blue-800'
  if (['Aguardando contrato', 'CONTRATO_GERADO', 'CONTRATO_ENVIADO', 'AGUARDANDO_ASSINATURA'].includes(status || '')) return 'bg-purple-100 text-purple-800'
  if (status === 'Cancelada' || status === 'CANCELADA') return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-800'
}

function nomeClienteDo(orcamento: Orcamento) {
  return orcamento.clientes?.nome || orcamento.oportunidades?.nome_contato || orcamento.contato_nome || 'Cliente não identificado'
}

function emailClienteDo(orcamento: Orcamento) {
  return orcamento.contato_email || orcamento.clientes?.email || orcamento.oportunidades?.email || null
}

function propostaPodeSerCancelada(orcamento: Orcamento) {
  return orcamento.status === 'ENVIADA' && !orcamento.resposta_cliente
}

function propostaPodeSerEnviada(orcamento: Orcamento) {
  return propostaPodeEnviar(orcamento.status, orcamento.resposta_cliente)
}

function propostaPodeSerEditada(orcamento: Orcamento) {
  return ['RASCUNHO', 'NOVO', 'EM_EDICAO', 'FINALIZADO'].includes(orcamento.status) && !orcamento.resposta_cliente && !orcamento.reserva_id
}

export function OrcamentosPage() {
  const [origemLinks, setOrigemLinks] = useState(ORIGEM_PUBLICA_PRODUCAO)
  useEffect(() => { setOrigemLinks(origemPublicaJornada(window.location.origin)) }, [])
  const oportunidadeUrlCarregada = useRef<string | null>(null)
  const carregamentoForm = useRef(0)
  const [carregandoForm, setCarregandoForm] = useState(false)
  const [taxas, setTaxas] = useState<TaxaEditor[]>([])
  const [conceituais, setConceituais] = useState<ItemConceitual[]>([])
  const [versao, setVersao] = useState<number | null>(null)
  const idempotencia = useRef<string | null>(null)
  const envioEmCurso = useRef(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [kits, setKits] = useState<Kit[]>([])
  const [acessorios, setAcessorios] = useState<AcessorioEstoque[]>([])
  const [buscaAcessorio, setBuscaAcessorio] = useState('')
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [form, setForm] = useState<FormOrcamento>(formVazio)
  const [tipoDesconto, setTipoDesconto] = useState<'VALOR' | 'PERCENTUAL'>('VALOR')
  const [itens, setItens] = useState<ItemForm[]>([novoItem()])
  const [disponibilidades, setDisponibilidades] = useState<Record<string, Disponibilidade>>({})
  const [formAberto, setFormAberto] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)
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
  const [gerandoCadastroId, setGerandoCadastroId] = useState<string | null>(null)
  const [linksCadastro, setLinksCadastro] = useState<Record<string, string>>({})
  const [mercadoPagoPronto, setMercadoPagoPronto] = useState(false)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    setErro('')

    const [clientesRes, oportunidadesRes, kitsRes, acessoriosRes, orcamentosRes, conceituaisRes] = await Promise.all([
      supabase.from('clientes').select('id,nome,whatsapp,email').order('nome'),
      supabase
        .from('oportunidades')
        .select('id,numero,cliente_id,nome_contato,celular,email,interesse,data_evento,etapa,versao,cadastro_completo_em,desconto_tipo,desconto_valor')
        .in('etapa', ['APROVADA', 'CONVERTIDA_EM_PROPOSTA'])
        .order('updated_at', { ascending: false }),
      supabase.from('kits').select('id,codigo,nome,valor').order('nome'),
      supabase
        .from('estoque_itens')
        .select('id,nome,codigo,categoria,quantidade_disponivel,valor_locacao')
        .or('status.is.null,status.neq.Inativo')
        .order('nome'),
      supabase
        .from('orcamentos')
        .select('*,clientes(nome,whatsapp,email),oportunidades(numero,nome_contato,celular,email,cadastro_completo_em),contratos(public_token,email_enviado_em,email_destino),lancamentos_financeiros(provedor_pagamento,link_pagamento,status_provedor)')
        .order('created_at', { ascending: false }),
      supabase.from('itens_conceituais').select('id,nome,preco_locacao_estimado').not('status', 'in', '(DESCARTADO,INCORPORADO_ESTOQUE)').order('nome')
    ])

    const primeiroErro = clientesRes.error || oportunidadesRes.error || kitsRes.error || acessoriosRes.error || orcamentosRes.error || conceituaisRes.error

    if (primeiroErro) {
      setErro(primeiroErro.message)
    } else {
      setConceituais(conceituaisRes.data || [])
      setClientes(clientesRes.data || [])
      setOportunidades(oportunidadesRes.data || [])
      setKits(kitsRes.data || [])
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
    if (!oportunidadeId || oportunidadeUrlCarregada.current === oportunidadeId || !oportunidades.some(item => item.id === oportunidadeId)) return
    oportunidadeUrlCarregada.current = oportunidadeId
    setFormAberto(true)
    void selecionarOportunidade(oportunidadeId)
  }, [oportunidades])

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

  const calculo = useMemo(() => calcularEditor(itens, taxas, tipoDesconto, form.desconto), [itens, taxas, tipoDesconto, form.desconto])
  const { subtotal, descontoCalculado: descontoEmReais, totalFinal: total } = calculo

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

  function iniciarNovo() {
    carregamentoForm.current += 1
    setCarregandoForm(false)
    setTaxas([])
    setVersao(null)
    idempotencia.current = crypto.randomUUID()
    setForm({ ...formVazio, validade: dataValidadeInicial() })
    setTipoDesconto('VALOR')
    setItens([novoItem()])
    setDisponibilidades({})
    setEditandoId(null)
    setErro('')
    setSucesso('')
    setFormAberto(true)
  }

  async function selecionarOportunidade(id: string) {
    const sequencia = ++carregamentoForm.current
    const oportunidade = oportunidades.find(item => item.id === id)
    setTipoDesconto(oportunidade?.desconto_tipo || 'VALOR')
    setForm(atual => ({
      ...atual,
      oportunidade_id: id,
      contato_nome: oportunidade?.nome_contato || atual.contato_nome,
      contato_telefone: oportunidade?.celular || atual.contato_telefone,
      contato_email: oportunidade?.email || '',
      tema_evento: oportunidade?.interesse || '',
      origem: id ? 'SITE' : 'MANUAL',
      cliente_id: oportunidade?.cliente_id || atual.cliente_id,
      data_evento: oportunidade?.data_evento || atual.data_evento,
      data_retirada: oportunidade?.data_evento || atual.data_retirada,
      data_devolucao: oportunidade?.data_evento || atual.data_devolucao,
      desconto: oportunidade?.desconto_valor || 0
    }))
    setDisponibilidades({})

    if (!id) return

    setCarregandoForm(true)
    const { data, error } = await supabase
      .from('oportunidade_itens')
      .select('id,tipo,kit_id,estoque_item_id,nome_snapshot,valor_referencia,quantidade')
      .eq('oportunidade_id', id)
      .order('ordem')
    if (sequencia !== carregamentoForm.current) return
    setCarregandoForm(false)

    if (error) {
      setErro(`Não foi possível carregar os itens escolhidos pelo cliente: ${error.message}`)
      return
    }

    if ((data || []).length > 0) {
      setItens((data || []).map(item => ({
        ...novoItem(),
        tipo_origem: item.kit_id ? 'KIT' : item.estoque_item_id ? 'ESTOQUE' : 'LIVRE',
        preco_base: item.valor_referencia ?? null,
        chave: item.id,
        kit_id: item.kit_id || '',
        estoque_item_id: item.estoque_item_id || '',
        descricao: item.nome_snapshot,
        quantidade: item.quantidade,
        valor_unitario: item.valor_referencia ?? (item.kit_id ? kits.find(kit => kit.id === item.kit_id)?.valor : acessorios.find(acessorio => acessorio.id === item.estoque_item_id)?.valor_locacao) ?? ''
      })))
    }
  }

  function selecionarCliente(id: string) {
    const cliente = clientes.find(item => item.id === id)
    setForm(atual => ({
      ...atual,
      cliente_id: id,
      contato_nome: cliente?.nome || atual.contato_nome,
      contato_telefone: cliente?.whatsapp || atual.contato_telefone,
      contato_email: cliente?.email || atual.contato_email,
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

  function adicionarAcessorio(acessorio: AcessorioEstoque) {
    setItens(atuais => {
      const vazio = atuais.length === 1
        && !atuais[0].kit_id
        && !atuais[0].estoque_item_id
        && !atuais[0].descricao.trim()
      const novo = {
        ...novoItem(),
        tipo_origem: 'ESTOQUE' as const,
        preco_base: acessorio.valor_locacao,
        estoque_item_id: acessorio.id,
        valor_unitario: acessorio.valor_locacao ?? '',
        descricao: `${acessorio.codigo ? `${acessorio.codigo} - ` : ''}${acessorio.nome}`
      }
      return vazio ? [novo] : [...atuais, novo]
    })
    setBuscaAcessorio('')
  }

  async function verificarDisponibilidade(item: ItemForm) {
    const inicio = form.data_retirada || form.data_evento
    const fim = form.data_devolucao || form.data_evento

    if (!inicio || !fim) {
      const resultado = { disponivel: false, motivo: 'Informe a data do evento ou o período.' }
      setDisponibilidades(atuais => ({ ...atuais, [item.chave]: resultado }))
      return resultado
    }

    if (item.kit_id) {
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

    if (item.estoque_item_id) {
      const { data, error } = await supabase.rpc('verificar_disponibilidade_estoque_item', {
        p_estoque_item_id: item.estoque_item_id,
        p_quantidade: Number(item.quantidade || 0),
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

    const resultado = { disponivel: true, motivo: 'Item livre sem vínculo com o estoque.' }
    setDisponibilidades(atuais => ({ ...atuais, [item.chave]: resultado }))
    return resultado
  }

  async function salvar(evento: React.FormEvent, finalizar = false) {
    evento.preventDefault()
    if (envioEmCurso.current || carregandoForm) return
    setErro('')
    setSucesso('')
    const falha = validarEditor(itens, taxas, tipoDesconto, form.desconto)
    if (falha) return setErro(falha)
    if (finalizar && (!form.data_evento || form.contato_nome.trim().length < 2 || !/^\d{10,11}$/.test(form.contato_telefone.replace(/\D/g, '')))) {
      return setErro('Para finalizar, informe nome, telefone com DDD e data do evento.')
    }
    envioEmCurso.current = true
    setSalvando(true)
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) throw new Error('Sua sessão expirou. Entre novamente no ERP.')
      idempotencia.current ||= crypto.randomUUID()
      const payload = {
        cliente_id: form.cliente_id || null, oportunidade_id: form.oportunidade_id || null,
        validade: form.validade || null, versao,
        status: finalizar ? 'FINALIZADO' : 'EM_EDICAO', origem: form.origem,
        contato_nome: form.contato_nome, contato_telefone: form.contato_telefone,
        contato_email: form.contato_email || null, tema_evento: form.tema_evento || null,
        data_evento: form.data_evento || null, horario_evento: form.horario_evento || null,
        data_retirada: form.data_retirada || form.data_evento || null,
        horario_retirada: form.horario_retirada || null,
        data_devolucao: form.data_devolucao || form.data_evento || null,
        endereco_evento: form.endereco_evento || null, observacoes: form.observacoes || null,
        desconto_tipo: tipoDesconto, desconto_valor: Number(form.desconto),
        ...serializarEditor(itens, taxas)
      }
      // NOVO precisa passar por EM_EDICAO antes da finalização.
      const salvarPayload = async (id: string | null, corpo: typeof payload) => {
        const resposta = await fetch(id ? `/api/orcamentos/${id}` : '/api/orcamentos', {
          method: id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session!.access_token}`, 'Idempotency-Key': idempotencia.current! },
          body: JSON.stringify(corpo)
        })
        const resultado = await resposta.json().catch(() => ({}))
        if (!resposta.ok || !resultado.orcamento) throw new Error(resultado.erro || 'Não foi possível salvar. Tente novamente; seus dados foram mantidos.')
        return resultado.orcamento
      }
      let versaoAtual = versao
      if (finalizar && editandoId && ['NOVO', 'FINALIZADO'].includes(form.status)) {
        const intermediario = await salvarPayload(editandoId, { ...payload, status: 'EM_EDICAO' })
        versaoAtual = intermediario.versao
        setVersao(versaoAtual)
        setForm(atual => ({ ...atual, status: 'EM_EDICAO' }))
      }
      const salvo = await salvarPayload(editandoId, { ...payload, versao: versaoAtual })
      setVersao(salvo.versao)
      setEditandoId(salvo.id)
      setForm(atual => ({ ...atual, status: salvo.status }))
      if (!editandoId && !salvo.criado) {
        setSucesso('O salvamento anterior foi recuperado. Revise os dados e salve novamente para aplicar eventuais alterações feitas após a tentativa anterior.')
        return
      }
      setSucesso(`${salvo.status === 'FINALIZADO' ? 'Orçamento finalizado' : 'Orçamento salvo'}. Total: ${moeda(salvo.total)}. ${(salvo.avisos || []).join(' ')}`)
      setFormAberto(false)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar o orçamento.')
    } finally {
      envioEmCurso.current = false
      setSalvando(false)
    }
  }

  async function carregarDadosDocumento(orcamento: Orcamento): Promise<DadosDocumento> {
    const itensPromise = supabase
      .from('orcamento_itens')
      .select('descricao,quantidade,valor_unitario,subtotal_negociado')
      .eq('orcamento_id', orcamento.id)
      .order('created_at')

    const clientePromise = orcamento.cliente_id
      ? supabase
          .from('clientes')
          .select('nome,whatsapp,email')
          .eq('id', orcamento.cliente_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const empresaPromise = orcamento.empresa_id
      ? supabase
          .from('empresas')
          .select('nome,nome_fantasia,razao_social,cnpj,email,telefone,whatsapp,site,logradouro,numero,complemento,bairro,cidade,estado,cep,logo_url')
          .eq('id', orcamento.empresa_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })

    const [itensRes, clienteRes, empresaRes] = await Promise.all([itensPromise, clientePromise, empresaPromise])

    if (itensRes.error) throw itensRes.error
    if (clienteRes.error) throw clienteRes.error
    if (empresaRes.error) throw empresaRes.error

    return {
      ...orcamento,
      acrescimos: Number(orcamento.acrescimos || 0) + Number(orcamento.total_taxas || 0),
      empresa: empresaRes.data || {
        nome: 'Cintia Paula Festas e Decorações',
        nome_fantasia: 'Cintia Paula Festas e Decorações',
        razao_social: null,
        cnpj: null,
        email: null,
        telefone: null,
        whatsapp: null,
        site: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        estado: null,
        cep: null,
        logo_url: null
      },
      cliente: clienteRes.data || {
        nome: orcamento.contato_nome || orcamento.oportunidades?.nome_contato || 'Cliente',
        whatsapp: orcamento.contato_telefone || orcamento.oportunidades?.celular || null,
        email: orcamento.oportunidades?.email || orcamento.contato_email || null
      },
      itens: (itensRes.data || []).map(item => ({
        descricao: item.descricao,
        quantidade: Number(item.quantidade),
        valor_unitario: Number(item.valor_unitario),
        subtotal: Number(item.subtotal_negociado)
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

  async function gerarLinkCadastro(orcamento: Orcamento, acao: 'consultar' | 'enviar_email' = 'consultar') {
    if (!orcamento.oportunidade_id) {
      setErro('Este orçamento não está vinculado a uma solicitação do cliente.')
      return
    }

    setGerandoCadastroId(orcamento.id)
    setErro('')
    setSucesso('')
    try {
      const { data } = await supabase.auth.getSession()
      if (!data.session) throw new Error('Sua sessão expirou. Entre novamente no ERP.')

      const resposta = await fetch(`/api/comercial/pre-reservas/${orcamento.oportunidade_id}/acompanhamento`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ acao })
      })
      const corpo = await resposta.json().catch(() => ({}))
      if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível gerar o link de cadastro.')

      setLinksCadastro(atuais => ({ ...atuais, [orcamento.id]: corpo.url }))
      setSucesso(acao === 'enviar_email'
        ? 'O serviço de e-mail recebeu a solicitação de envio do link de cadastro.'
        : 'Link seguro gerado. Envie-o ao cliente para completar os dados do contrato.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar o link de cadastro.')
    } finally {
      setGerandoCadastroId(null)
    }
  }

  async function registrarEnvio(orcamento: Orcamento) {
    if (orcamento.status === 'ENVIADA' || orcamento.status === 'ACEITA') return orcamento.public_token
    if (!propostaPodeSerEnviada(orcamento)) throw new Error('Finalize o orçamento antes de compartilhar a proposta.')

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
    const tokenPublico = dados.proposta.public_token || orcamento.public_token
    if (!tokenPublico) throw new Error('Não foi possível obter o link da proposta.')
    return tokenPublico
  }

  async function compartilharPdf(orcamento: Orcamento) {
    setErro('')
    setSucesso('')
    setAcaoDocumento(`compartilhar:${orcamento.id}`)

    try {
      const tokenPublico = await registrarEnvio(orcamento)
      const dados = await carregarDadosDocumento(orcamento)
      const { doc, nomeArquivo } = await criarDocumentoOrcamento(dados)
      const link_publico = tokenPublico
        ? `${origemLinks}/proposta/${tokenPublico}`
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

    let tokenPublico: string | null
    try {
      tokenPublico = await registrarEnvio(orcamento)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível liberar a proposta para envio.')
      return
    }

    const link = `${origemLinks}/proposta/${tokenPublico}`
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
    const email = emailClienteDo(orcamento)
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
      await carregar()
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

    const link = `${origemLinks}/contrato/${orcamento.contratos.public_token}`
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
    const sequencia = ++carregamentoForm.current
    setCarregandoForm(true)
    setErro('')
    const { data: registro, error } = await supabase.from('orcamentos')
      .select('*,orcamento_itens(*),orcamento_taxas(*)').eq('id', orcamento.id).single()
    if (sequencia !== carregamentoForm.current) return
    setCarregandoForm(false)
    if (error) return setErro(error.message)
    if (!propostaPodeSerEditada(registro)) return setErro('Este orçamento não está mais disponível para edição. Atualize a lista.')
    setVersao(registro.versao)
    idempotencia.current = null
    setForm({
      ...formVazio,
      cliente_id: registro.cliente_id || '', oportunidade_id: registro.oportunidade_id || '',
      status: registro.status, origem: registro.origem || 'MANUAL',
      contato_nome: registro.contato_nome || nomeClienteDo(orcamento),
      contato_telefone: registro.contato_telefone || orcamento.clientes?.whatsapp || orcamento.oportunidades?.celular || '',
      contato_email: registro.contato_email || emailClienteDo(orcamento) || '',
      tema_evento: registro.tema_evento || '', validade: registro.validade || '',
      data_evento: registro.data_evento || '', horario_evento: registro.horario_evento || '',
      data_retirada: registro.data_retirada || '', horario_retirada: registro.horario_retirada || '',
      data_devolucao: registro.data_devolucao || '', endereco_evento: registro.endereco_evento || '',
      desconto: registro.desconto_valor ?? registro.desconto ?? 0, observacoes: registro.observacoes || ''
    })
    setTipoDesconto(registro.desconto_tipo || 'VALOR')
    setItens((registro.orcamento_itens || []).sort((a, b) => a.ordem - b.ordem).map(item => ({
      ...novoItem(), chave: item.id, tipo_origem: item.tipo_origem,
      kit_id: item.kit_id || '', estoque_item_id: item.estoque_item_id || '', item_conceitual_id: item.item_conceitual_id || '',
      descricao: item.descricao, quantidade: item.quantidade,
      valor_unitario: item.preco_unitario_orcamento ?? item.valor_unitario,
      preco_base: item.preco_base, desconto: item.desconto || 0, observacao: item.observacao || ''
    })))
    const taxasSalvas = (registro.orcamento_taxas || []).sort((a, b) => a.ordem - b.ordem).map(taxa => ({
      chave: taxa.id, descricao: taxa.descricao, tipo: taxa.tipo, valor: taxa.valor, observacao: taxa.observacao || ''
    }))
    if (Number(registro.acrescimos) > 0) taxasSalvas.push({ chave: crypto.randomUUID(), descricao: 'Acréscimos', tipo: 'EXTRA', valor: registro.acrescimos, observacao: '' })
    if (Number(registro.frete) > 0) taxasSalvas.push({ chave: crypto.randomUUID(), descricao: 'Frete / entrega', tipo: 'ENTREGA', valor: registro.frete, observacao: '' })
    setTaxas(taxasSalvas)
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
          <p className="mt-1 text-slate-500">Revise a solicitação, ajuste itens e preços e envie o próximo passo ao cliente.</p>
        </div>
        <Button disabled={salvando} onClick={iniciarNovo} className="flex items-center justify-center gap-2"><Plus size={18} /> Novo orçamento</Button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      {carregandoForm && <p role="status">Carregando dados do orçamento...</p>}
      {formAberto && (
        <Card className="border-pink-200">
          <form onSubmit={evento => void salvar(evento, (evento.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "finalizar")} className="space-y-6">
            <fieldset disabled={salvando || carregandoForm} className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{editandoId ? 'Editar orçamento' : 'Novo orçamento'}</h2>
              <p className="text-sm text-slate-500">Escolha uma solicitação do site ou um cliente, revise tudo e salve. Depois, gere o link para os dados do contrato.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <Select label="Cliente cadastrado (opcional)" value={form.cliente_id} onChange={evento => selecionarCliente(evento.target.value)}>
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
                <p className="mt-1 text-xs text-slate-500">Dispensável quando uma solicitação do site estiver selecionada.</p>
              </div>
              <div>
                <Select label="Solicitação de orçamento (opcional)" value={form.oportunidade_id} onChange={evento => void selecionarOportunidade(evento.target.value)}>
                  <option value="">Orçamento direto para o cliente</option>
                  {oportunidades
                    .filter(item => !form.cliente_id || !item.cliente_id || item.cliente_id === form.cliente_id)
                    .filter(item => item.etapa !== 'CONVERTIDA_EM_PROPOSTA' || item.id === form.oportunidade_id)
                    .map(item => (
                      <option key={item.id} value={item.id}>
                        SOL-{String(item.numero).padStart(4, '0')} — {item.nome_contato}
                      </option>
                    ))}
                </Select>
                <p className="mt-1 text-xs text-slate-500">Ao selecionar uma solicitação do site, todos os itens escolhidos pelo cliente são carregados automaticamente e continuam editáveis.</p>
              </div>
              <div className="rounded-xl border bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">Status</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{form.status === 'FINALIZADO' ? 'Finalizado' : 'Em edição'}</p>
                <p className="mt-1 text-xs text-slate-500">Salve suas alterações ou finalize o orçamento após a revisão.</p>
              </div>
              <Input label="Nome do contato" value={form.contato_nome} onChange={evento => setForm({ ...form, contato_nome: evento.target.value })} />
              <Input label="Telefone com DDD" value={form.contato_telefone} onChange={evento => setForm({ ...form, contato_telefone: evento.target.value })} />
              <Input label="E-mail do contato" type="email" value={form.contato_email} onChange={evento => setForm({ ...form, contato_email: evento.target.value })} />
              <Input label="Tema do evento" value={form.tema_evento} onChange={evento => setForm({ ...form, tema_evento: evento.target.value })} />
              <Input label="Validade" type="date" value={form.validade} onChange={evento => setForm({ ...form, validade: evento.target.value })} />
              <Input label="Data do evento *" type="date" value={form.data_evento} onChange={evento => { setForm({ ...form, data_evento: evento.target.value }); setDisponibilidades({}) }} />
              <Input label="Horário do evento" placeholder="Ex.: 14:00" value={form.horario_evento} onChange={evento => setForm({ ...form, horario_evento: evento.target.value })} />
              <Input label="Endereço do evento" value={form.endereco_evento} onChange={evento => setForm({ ...form, endereco_evento: evento.target.value })} />
              <Input label="Data de retirada" type="date" value={form.data_retirada} onChange={evento => { setForm({ ...form, data_retirada: evento.target.value }); setDisponibilidades({}) }} />
              <Input label="Horário da retirada" type="time" value={form.horario_retirada} onChange={evento => setForm({ ...form, horario_retirada: evento.target.value })} />
              <Input label="Data de devolução" type="date" value={form.data_devolucao} onChange={evento => { setForm({ ...form, data_devolucao: evento.target.value }); setDisponibilidades({}) }} />
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-slate-900">Itens da festa</h3>
                <p className="text-sm text-slate-500">Revise as peças escolhidas e adicione itens do estoque ou itens livres quando necessário.</p>
              </div>

              <div className="rounded-2xl border border-pink-100 bg-pink-50/50 p-4">
                <div className="mb-3">
                  <h4 className="font-semibold text-slate-900">Adicionar peças do catálogo</h4>
                  <p className="text-xs text-slate-500">Pesquise, adicione e ajuste quantidade e preço. Uma peça comprometida em outra data não impede criar o orçamento.</p>
                </div>
                <Input
                  aria-label="Buscar item do estoque"
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
                      <span className="shrink-0 text-xs text-slate-500">Base disponível: {acessorio.quantidade_disponivel || 0} · Adicionar +</span>
                    </button>
                  ))}
                  {acessoriosFiltrados.length === 0 && <p className="px-3 py-4 text-center text-sm text-slate-500">Nenhum item de estoque encontrado.</p>}
                </div>
              </div>

              <Select label="Adicionar kit" value="" onChange={evento => {
                const kit = kits.find(item => item.id === evento.target.value)
                if (kit) setItens(atuais => [...atuais.filter(item => item.descricao.trim() || item.kit_id || item.estoque_item_id || item.item_conceitual_id), { ...novoItem(), tipo_origem: 'KIT', kit_id: kit.id, descricao: kit.nome, preco_base: kit.valor, valor_unitario: kit.valor ?? '' }])
              }}><option value="">Selecione um kit...</option>{kits.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</Select>
              <Select label="Adicionar item conceitual" value="" onChange={evento => {
                const conceito = conceituais.find(item => item.id === evento.target.value)
                if (conceito) setItens(atuais => [...atuais.filter(item => item.descricao.trim() || item.kit_id || item.estoque_item_id || item.item_conceitual_id), { ...novoItem(), tipo_origem: 'CONCEITUAL', item_conceitual_id: conceito.id, descricao: conceito.nome, preco_base: conceito.preco_locacao_estimado, valor_unitario: conceito.preco_locacao_estimado ?? '' }])
              }}><option value="">Selecione um conceito cadastrado...</option>{conceituais.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</Select>
              {conceituais.length === 0 && <p className="text-sm text-slate-500">Nenhum item conceitual disponível.</p>}
              <div className="flex justify-end">
                <Button variant="secondary" onClick={() => setItens(atuais => [...atuais, novoItem()])}><Plus size={16} className="inline" /> Adicionar item livre</Button>
              </div>

              {itens.map((item, indice) => {
                const disponibilidade = disponibilidades[item.chave]
                return (
                  <div key={item.chave} className="rounded-2xl border bg-slate-50 p-4">
                    <p className="mb-3 text-xs font-semibold text-slate-600">{item.tipo_origem} · Preço-base: {item.preco_base == null ? 'não informado' : moeda(item.preco_base)}</p>
                    {item.tipo_origem === 'CONCEITUAL' && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Item conceitual: depende de aquisição ou produção e não representa disponibilidade física.</p>}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <Input required label="Descrição *" className="xl:col-span-2" value={item.descricao} onChange={evento => atualizarItem(item.chave, { descricao: evento.target.value })} />
                      <Input required label="Quantidade" type="number" min="0.01" step="0.01" value={item.quantidade} onChange={evento => atualizarItem(item.chave, { quantidade: evento.target.value })} />
                      <Input placeholder="Informe o preço de locação" required label="Valor unitário" type="number" min="0" step="0.01" value={item.valor_unitario} onChange={evento => atualizarItem(item.chave, { valor_unitario: evento.target.value })} />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Input label="Desconto deste item (R$)" type="number" min="0" step="0.01" value={item.desconto} onChange={evento => atualizarItem(item.chave, { desconto: evento.target.value })} />
                      <Input label="Observação do item" value={item.observacao} onChange={evento => atualizarItem(item.chave, { observacao: evento.target.value })} />
                    </div>
                    {item.estoque_item_id && !item.kit_id && (
                      <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800">
                        Item vinculado ao estoque físico. O bloqueio ocorrerá somente quando a reserva for confirmada.
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-semibold">Subtotal: {moeda(calcularEditor([item], [], 'VALOR', 0).subtotal)}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {disponibilidade && (
                          <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${disponibilidade.disponivel ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {disponibilidade.disponivel ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}{disponibilidade.motivo}
                          </span>
                        )}
                        {(item.kit_id || item.estoque_item_id) && <Button variant="secondary" onClick={() => verificarDisponibilidade(item)}><CalendarCheck size={16} className="inline" /> Consultar disponibilidade</Button>}
                        {itens.length > 1 && <Button variant="danger" aria-label={`Remover item ${indice + 1}`} onClick={() => setItens(atuais => atuais.filter(linha => linha.chave !== item.chave))}><Trash2 size={16} /></Button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <section className="space-y-3" aria-label="Taxas do orçamento">
              <h3 className="font-bold">Taxas</h3>
              {taxas.map((taxa, indice) => <div key={taxa.chave} className="grid gap-3 rounded-xl border p-3 md:grid-cols-2">
                <Input required label={`Descrição da taxa ${indice + 1}`} value={taxa.descricao} onChange={evento => setTaxas(atuais => atuais.map(item => item.chave === taxa.chave ? { ...item, descricao: evento.target.value } : item))} />
                <Select label="Tipo da taxa" value={taxa.tipo} onChange={evento => setTaxas(atuais => atuais.map(item => item.chave === taxa.chave ? { ...item, tipo: evento.target.value } : item))}>{tiposTaxa.map(tipo => <option key={tipo}>{tipo}</option>)}</Select>
                <Input required label="Valor da taxa (R$)" type="number" min="0" step="0.01" value={taxa.valor} onChange={evento => setTaxas(atuais => atuais.map(item => item.chave === taxa.chave ? { ...item, valor: evento.target.value } : item))} />
                <Input label="Observação da taxa" value={taxa.observacao} onChange={evento => setTaxas(atuais => atuais.map(item => item.chave === taxa.chave ? { ...item, observacao: evento.target.value } : item))} />
                <Button variant="danger" onClick={() => setTaxas(atuais => atuais.filter(item => item.chave !== taxa.chave))}>Remover taxa {indice + 1}</Button>
              </div>)}
              <Button variant="secondary" onClick={() => setTaxas(atuais => [...atuais, { chave: crypto.randomUUID(), descricao: '', valor: '', tipo: 'OUTRA', observacao: '' }])}>Adicionar taxa</Button>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <Textarea label="Observações da proposta" rows={6} value={form.observacoes} onChange={evento => setForm({ ...form, observacoes: evento.target.value })} />
              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <h3 className="font-bold">Resumo financeiro</h3>
                <div className="mt-4 space-y-3">
                  <p className="flex justify-between text-sm text-slate-300"><span>Subtotal</span><strong>{moeda(subtotal)}</strong></p>
                  <div className="space-y-2">
                     <label htmlFor="tipo-desconto" className="block text-sm font-semibold text-slate-200">Tipo de desconto na proposta</label>
                     <select id="tipo-desconto" value={tipoDesconto} onChange={evento => { setTipoDesconto(evento.target.value as 'VALOR' | 'PERCENTUAL'); setForm(atual => ({ ...atual, desconto: 0 })) }} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900">
                       <option value="VALOR">Valor em reais (R$)</option>
                       <option value="PERCENTUAL">Percentual (%)</option>
                     </select>
                     <Input label={tipoDesconto === 'PERCENTUAL' ? 'Desconto (%)' : 'Desconto (R$)'} type="number" min="0" max={tipoDesconto === 'PERCENTUAL' ? 100 : subtotal} step="0.01" className="bg-white text-slate-900" value={form.desconto} onChange={evento => setForm({ ...form, desconto: evento.target.value })} />
                     <p className="text-sm text-slate-300">Desconto aplicado: {moeda(descontoEmReais)}. O tipo e o valor serão preservados no orçamento.</p>
                   </div>
                  <p className="flex justify-between text-sm"><span>Taxas</span><strong>{moeda(calculo.totalTaxas)}</strong></p>
                  <div className="border-t border-slate-700 pt-4"><p className="flex items-end justify-between"><span>Total</span><strong className="text-2xl text-pink-300">{moeda(total)}</strong></p></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {form.oportunidade_id && !oportunidades.find(item => item.id === form.oportunidade_id)?.cadastro_completo_em && <p className="text-sm text-amber-800">Salve o orçamento e use o botão “Gerar link para completar cadastro”. Depois dos dados, o contrato poderá ser gerado.</p>}
              <Button type="submit" variant="secondary" disabled={salvando}>Salvar rascunho</Button>
              <Button type="submit" value="finalizar" disabled={salvando} className="flex items-center justify-center gap-2"><Send size={17} /> {salvando ? 'Salvando...' : 'Finalizar orçamento'}</Button>
              <Button variant="secondary" onClick={() => { setFormAberto(false); setEditandoId(null); setErro('') }}>Cancelar</Button>
            </div>
            </fieldset>
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
              <p>Evento: {dataCurta(orcamento.data_evento)}</p>
              <p>Retirada: {dataCurta(orcamento.data_retirada)}{orcamento.horario_retirada ? ` às ${orcamento.horario_retirada.slice(0, 5)}` : ''}</p>
              <p>Validade: {dataCurta(orcamento.validade)}</p>
              <p className="pt-2 text-xl font-bold text-slate-900">{moeda(orcamento.total)}</p>
            </div>
            {orcamento.email_enviado_em && (
              <p className="mt-3 text-xs text-slate-500">
                E-mail enviado em {new Date(orcamento.email_enviado_em).toLocaleString('pt-BR')} para {orcamento.email_destino || emailClienteDo(orcamento)}
              </p>
            )}
            {orcamento.resposta_cliente && (
              <div className={`mt-4 rounded-xl px-3 py-2 text-xs ${orcamento.resposta_cliente === 'ACEITA' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                <p className="font-bold">Cliente {orcamento.resposta_cliente === 'ACEITA' ? 'aceitou' : 'recusou'} a proposta</p>
                <p className="mt-0.5">{orcamento.respondido_por || 'Cliente'} · {orcamento.respondido_em ? new Date(orcamento.respondido_em).toLocaleString('pt-BR') : 'data não informada'}</p>
                {orcamento.resposta_observacao && <p className="mt-1">“{orcamento.resposta_observacao}”</p>}
              </div>
            )}
            {orcamento.oportunidade_id && !orcamento.oportunidades?.cadastro_completo_em && ['RASCUNHO', 'NOVO', 'EM_EDICAO', 'FINALIZADO'].includes(orcamento.status) && (
              <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-sm font-bold text-violet-900">Próximo passo: dados para o contrato</p>
                <p className="mt-1 text-xs leading-5 text-violet-800">Depois de revisar e salvar itens, preços e desconto, gere o link para o cliente completar apenas os dados contratuais.</p>
                <Button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2"
                  disabled={gerandoCadastroId === orcamento.id}
                  onClick={() => void gerarLinkCadastro(orcamento)}
                >
                  <FileSignature size={16} />
                  {gerandoCadastroId === orcamento.id ? 'Gerando link...' : 'Gerar link para completar cadastro'}
                </Button>
                {linksCadastro[orcamento.id] && (
                  <div className="mt-3 space-y-2">
                    <input aria-label={`Link de cadastro do orçamento ${orcamento.numero}`} readOnly value={linksCadastro[orcamento.id]} onFocus={evento => evento.target.select()} className="w-full rounded-xl border border-violet-200 bg-white p-3 text-xs" />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button variant="secondary" type="button" onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(linksCadastro[orcamento.id])
                          setSucesso('Link de cadastro copiado.')
                        } catch {
                          setErro('Selecione o link acima e copie manualmente.')
                        }
                      }}><Copy size={15} /> Copiar link</Button>
                      <a className="flex items-center justify-center rounded-xl border bg-white px-3 py-2 text-xs font-bold text-green-700" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${telefoneWhatsApp(orcamento.oportunidades?.celular || '')}?text=${encodeURIComponent(`Olá! Seu orçamento ORC-${String(orcamento.numero).padStart(4, '0')} foi preparado. Complete seus dados para gerarmos o contrato: ${linksCadastro[orcamento.id]}`)}`}>WhatsApp</a>
                      <Button variant="secondary" type="button" disabled={gerandoCadastroId === orcamento.id || !emailClienteDo(orcamento)} onClick={() => void gerarLinkCadastro(orcamento, 'enviar_email')}><Mail size={15} /> Enviar e-mail</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {orcamento.status === 'ACEITA' && (
              <div className="mt-4 rounded-2xl border border-pink-100 bg-pink-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-pink-700">Formalização da venda</p>
                    <p className="mt-0.5 text-xs text-slate-500">Reserva provisória, contrato e cobrança. O estoque entra somente na confirmação.</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${corFormalizacao(orcamento.formalizacao_status)}`}>
                    {orcamento.formalizacao_status || 'AGUARDANDO_DADOS'}
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

                {!orcamento.contrato_id && orcamento.formalizacao_status === 'AGUARDANDO_DADOS' ? (
                  <p className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800">
                    Aguardando o cliente concluir CPF, endereço e dados necessários para o contrato na página da proposta.
                  </p>
                ) : !orcamento.contrato_id ? (
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

                    {['Venda confirmada', 'RESERVA_CONFIRMADA'].includes(orcamento.formalizacao_status || '') && (
                      <p className="rounded-xl bg-green-600 px-4 py-3 text-center text-sm font-bold text-white">Reserva confirmada. Estoque bloqueado para o período e operação liberada.</p>
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
                disabled={!propostaPodeSerEnviada(orcamento) && orcamento.status !== 'ACEITA'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => copiarLinkPublico(orcamento)}
              >
                <Copy size={17} /> Copiar link da proposta
              </button>
              {orcamento.public_token && ['ENVIADA', 'ACEITA'].includes(orcamento.status) && <a
                className="flex w-full items-center justify-center rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm font-bold text-green-800"
                target="_blank" rel="noopener noreferrer"
                href={`https://wa.me/${telefoneWhatsApp(orcamento.contato_telefone || orcamento.clientes?.whatsapp || orcamento.oportunidades?.celular || '')}?text=${encodeURIComponent(`Olá! Seu orçamento ORC-${String(orcamento.numero).padStart(4, '0')} da Cintia Paula está disponível para conferir: ${origemLinks}/proposta/${orcamento.public_token}`)}`}
              >Abrir WhatsApp com orçamento</a>}
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
              {orcamento.public_token && ['ENVIADA', 'ACEITA', 'RECUSADA', 'EXPIRADA'].includes(orcamento.status) ? (
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
                  Abrir reserva vinculada
                </Link>
              ) : null}
              <Button
                variant="secondary"
                disabled={salvando || carregandoForm || !propostaPodeSerEditada(orcamento)}
                onClick={() => editar(orcamento)}
              >
                {propostaPodeSerEditada(orcamento)
                  ? 'Editar orçamento'
                  : orcamento.resposta_cliente
                    ? 'Proposta respondida'
                    : orcamento.status === 'ENVIADA'
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
