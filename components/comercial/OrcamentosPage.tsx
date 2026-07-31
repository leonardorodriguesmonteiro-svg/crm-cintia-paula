'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, CheckCircle2, CircleAlert, Copy, Download, ExternalLink, FileSignature, HandCoins, Plus, Send, Share2, Trash2 } from 'lucide-react'
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
}

type Kit = {
  id: string
  codigo: string | null
  nome: string
  valor: number | null
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
  resposta_cliente: 'Aprovado' | 'Recusado' | null
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
  contratos: {
    public_token: string | null
  } | null
}

type FormOrcamento = {
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
  if (status === 'Aprovado') return 'bg-green-100 text-green-800'
  if (status === 'Enviado') return 'bg-blue-100 text-blue-800'
  if (status === 'Recusado') return 'bg-red-100 text-red-800'
  if (status === 'Expirado') return 'bg-slate-200 text-slate-700'
  return 'bg-amber-100 text-amber-800'
}

function corFormalizacao(status: string | null) {
  if (status === 'Venda confirmada') return 'bg-green-100 text-green-800'
  if (status === 'Aguardando sinal') return 'bg-blue-100 text-blue-800'
  if (status === 'Aguardando contrato') return 'bg-purple-100 text-purple-800'
  if (status === 'Cancelada') return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-800'
}

export function OrcamentosPage() {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [kits, setKits] = useState<Kit[]>([])
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
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    setErro('')

    const [oportunidadesRes, kitsRes, orcamentosRes] = await Promise.all([
      supabase
        .from('oportunidades')
        .select('id,numero,cliente_id,nome_contato,celular,email,interesse,data_evento,etapa')
        .neq('etapa', 'Perdido')
        .order('updated_at', { ascending: false }),
      supabase.from('kits').select('id,codigo,nome,valor').order('nome'),
      supabase
        .from('orcamentos')
        .select('*,oportunidades(numero,nome_contato,celular,email),contratos(public_token)')
        .order('created_at', { ascending: false })
    ])

    const primeiroErro = oportunidadesRes.error || kitsRes.error || orcamentosRes.error

    if (primeiroErro) {
      setErro(primeiroErro.message)
    } else {
      setOportunidades(oportunidadesRes.data || [])
      setKits(kitsRes.data || [])
      setOrcamentos((orcamentosRes.data as unknown as Orcamento[]) || [])
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
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
    if (!oportunidade?.data_evento) return

    setForm(atual => ({
      ...atual,
      data_evento: oportunidade.data_evento || '',
      data_retirada: oportunidade.data_evento || '',
      data_devolucao: oportunidade.data_evento || ''
    }))
  }, [form.data_evento, form.oportunidade_id, oportunidades])

  const subtotal = useMemo(
    () => itens.reduce(
      (total, item) => total + Number(item.quantidade || 0) * Number(item.valor_unitario || 0),
      0
    ),
    [itens]
  )

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
      data_evento: oportunidade?.data_evento || atual.data_evento,
      data_retirada: oportunidade?.data_evento || atual.data_retirada,
      data_devolucao: oportunidade?.data_evento || atual.data_devolucao
    }))
    setDisponibilidades({})
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

    if (!form.oportunidade_id) return setErro('Selecione a oportunidade deste orçamento.')
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
    const { data: vinculo } = await supabase
      .from('usuarios_empresa')
      .select('empresa_id')
      .eq('usuario_id', user.id)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()

    const desejaAprovar = form.status === 'Aprovado'
    const payload = {
      empresa_id: vinculo?.empresa_id || null,
      oportunidade_id: form.oportunidade_id,
      cliente_id: oportunidade?.cliente_id || null,
      status: desejaAprovar ? 'Enviado' : form.status,
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
    if (orcamento.status !== 'Rascunho') return

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

  function valorSinalDo(orcamento: Orcamento) {
    return valoresSinal[orcamento.id]
      ?? String(orcamento.valor_sinal_formalizacao || Math.max(orcamento.total * 0.3, 1).toFixed(2))
  }

  function vencimentoSinalDo(orcamento: Orcamento) {
    return vencimentosSinal[orcamento.id]
      ?? orcamento.vencimento_sinal
      ?? dataVencimentoSinalInicial()
  }

  async function formalizarVenda(orcamento: Orcamento) {
    setErro('')
    setSucesso('')
    setFormalizandoId(orcamento.id)

    const { data, error } = await supabase.rpc('formalizar_orcamento_aprovado', {
      p_orcamento_id: orcamento.id,
      p_valor_sinal: Number(valorSinalDo(orcamento)),
      p_vencimento: vencimentoSinalDo(orcamento)
    })

    if (error) {
      setErro(error.message)
    } else {
      setSucesso(data?.mensagem || 'Venda formalizada com sucesso.')
      await carregar()
    }

    setFormalizandoId(null)
  }

  async function confirmarAssinatura(orcamento: Orcamento) {
    if (!window.confirm('Confirmar que o contrato foi assinado pelo cliente?')) return

    setErro('')
    setSucesso('')
    setAssinandoId(orcamento.id)

    const { data, error } = await supabase.rpc('confirmar_assinatura_formalizacao', {
      p_orcamento_id: orcamento.id
    })

    if (error) setErro(error.message)
    else {
      setSucesso(data?.mensagem || 'Assinatura confirmada.')
      await carregar()
    }

    setAssinandoId(null)
  }

  async function confirmarSinal(orcamento: Orcamento) {
    if (!window.confirm(`Confirmar o recebimento de ${moeda(orcamento.valor_sinal_formalizacao || 0)}?`)) return

    setErro('')
    setSucesso('')
    setRecebendoSinalId(orcamento.id)

    const { data, error } = await supabase.rpc('confirmar_pagamento_sinal_formalizacao', {
      p_orcamento_id: orcamento.id,
      p_forma_pagamento: formasSinal[orcamento.id] || 'Pix'
    })

    if (error) setErro(error.message)
    else {
      setSucesso(data?.mensagem || 'Pagamento do sinal confirmado.')
      await carregar()
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
              <p className="text-sm text-slate-500">Defina a oportunidade, período e itens da proposta.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Select label="Oportunidade *" value={form.oportunidade_id} onChange={evento => selecionarOportunidade(evento.target.value)}>
                <option value="">Selecione...</option>
                {oportunidades.map(item => <option key={item.id} value={item.id}>OP-{String(item.numero).padStart(4, '0')} — {item.nome_contato}</option>)}
              </Select>
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
                <div><h3 className="font-bold text-slate-900">Itens da proposta</h3><p className="text-sm text-slate-500">Selecione um kit ou descreva um adicional.</p></div>
                <Button variant="secondary" onClick={() => setItens(atuais => [...atuais, novoItem()])}><Plus size={16} className="inline" /> Adicionar item</Button>
              </div>

              {itens.map((item, indice) => {
                const disponibilidade = disponibilidades[item.chave]
                return (
                  <div key={item.chave} className="rounded-2xl border bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                      <Select label="Kit (opcional)" className="xl:col-span-2" value={item.kit_id} onChange={evento => selecionarKit(item.chave, evento.target.value)}>
                        <option value="">Item adicional</option>
                        {kits.map(kit => <option key={kit.id} value={kit.id}>{kit.codigo ? `${kit.codigo} - ` : ''}{kit.nome}</option>)}
                      </Select>
                      <Input label="Descrição *" className="xl:col-span-2" value={item.descricao} onChange={evento => atualizarItem(item.chave, { descricao: evento.target.value })} />
                      <Input label="Quantidade" type="number" min="0.01" step="0.01" value={item.quantidade} onChange={evento => atualizarItem(item.chave, { quantidade: evento.target.value })} />
                      <Input label="Valor unitário" type="number" min="0" step="0.01" value={item.valor_unitario} onChange={evento => atualizarItem(item.chave, { valor_unitario: evento.target.value })} />
                    </div>
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
              <div><p className="text-xs font-bold text-pink-700">ORC-{String(orcamento.numero).padStart(4, '0')}</p><h2 className="font-bold text-slate-900">{orcamento.oportunidades?.nome_contato || 'Oportunidade não vinculada'}</h2></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${corStatus(orcamento.status)}`}>{orcamento.status}</span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-slate-500">
              <p>Evento: {dataCurta(orcamento.data_evento)}</p><p>Validade: {dataCurta(orcamento.validade)}</p><p className="pt-2 text-xl font-bold text-slate-900">{moeda(orcamento.total)}</p>
            </div>
            {orcamento.resposta_cliente && (
              <div className={`mt-4 rounded-xl px-3 py-2 text-xs ${orcamento.resposta_cliente === 'Aprovado' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                <p className="font-bold">Cliente {orcamento.resposta_cliente === 'Aprovado' ? 'aprovou' : 'recusou'} a proposta</p>
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
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="flex items-center justify-center gap-1 px-2 text-xs" onClick={() => copiarLinkContrato(orcamento)}><Copy size={15} /> Copiar link de assinatura</Button>
                        <a href={`/contrato/${orcamento.contratos.public_token}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1 rounded-xl border border-pink-200 bg-pink-50 px-2 py-2 text-xs font-semibold text-pink-700 hover:bg-pink-100"><ExternalLink size={15} /> Página do cliente</a>
                      </div>
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
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  disabled={!orcamento.public_token}
                  className="flex items-center justify-center gap-1 px-2"
                  onClick={() => copiarLinkPublico(orcamento)}
                >
                  <Copy size={16} /> Copiar link
                </Button>
                {orcamento.public_token ? (
                  <a
                    href={`/proposta/${orcamento.public_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1 rounded-xl border bg-white px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ExternalLink size={16} /> Ver proposta
                  </a>
                ) : (
                  <span className="flex items-center justify-center rounded-xl border bg-slate-50 px-2 py-2 text-sm text-slate-400">Link indisponível</span>
                )}
              </div>
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
              <Button variant="secondary" onClick={() => editar(orcamento)}>Editar orçamento</Button>
            </div>
          </Card>
        ))}
      </div>

      {!carregando && orcamentos.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">Nenhum orçamento cadastrado.</div>}
      {carregando && <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Carregando orçamentos...</div>}
    </div>
  )
}
