'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Check, CheckCircle2, Clock3, Copy, CreditCard, FileSignature, MapPin, PartyPopper, Printer, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { clausulasLocacaoContrato, declaracaoAceiteContrato, termosGeraisContrato } from '@/lib/contratoTermos'

type ContratoPublico = {
  empresa: {
    nome: string
    razao_social: string | null
    cnpj: string | null
    email: string | null
    telefone: string | null
    whatsapp: string | null
    site: string | null
    endereco: string | null
    logo_url: string | null
    contrato_padrao: string | null
  }
  numero: string
  status: string
  criado_em: string | null
  cliente: string
  contratante: {
    nome: string
    cpf: string | null
    rg: string | null
    whatsapp: string | null
    email: string | null
    endereco: string | null
  }
  evento: { data: string | null; horario: string | null; endereco: string | null }
  kit: { nome: string; codigo: string | null }
  itens: Array<{ descricao: string; quantidade: number; valor_unitario: number; subtotal: number; kit: boolean }>
  valor_total: number
  assinatura: { nome: string | null; documento: string | null; em: string | null; aceite: boolean } | null
  pode_assinar: boolean
  pagamento: {
    valor_sinal: number
    vencimento: string | null
    pago: boolean
    pix_chave: string | null
    pix_copia_cola: string | null
    link: string | null
    provedor: string | null
    status_provedor: string | null
    instrucoes: string
  }
}

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataCurta(valor: string | null) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function dataHora(valor: string | null) {
  if (!valor) return '-'
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function ContratoPublicoPage({ token }: { token: string }) {
  const [contrato, setContrato] = useState<ContratoPublico | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [assinando, setAssinando] = useState(false)
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const resposta = await fetch(`/api/contratos/${token}`, { cache: 'no-store' })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível carregar o contrato.')
      setContrato(corpo.contrato)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar o contrato.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    async function iniciar() {
      const busca = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const retorno = busca.get('pagamento') || hash.get('pagamento')
      const paymentId = busca.get('payment_id')
        || busca.get('collection_id')
        || hash.get('payment_id')
        || hash.get('collection_id')

      let avisoRetorno = ''

      if (retorno || paymentId) {
        try {
          const resposta = await fetch(`/api/contratos/${token}/pagamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_id: paymentId })
          })
          const corpo = await resposta.json()

          if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível confirmar o pagamento.')
          if (corpo.conciliado) avisoRetorno = 'Pagamento confirmado com sucesso.'
          else if (corpo.status === 'pending') avisoRetorno = 'Pagamento recebido e ainda em processamento.'
        } catch (error) {
          avisoRetorno = error instanceof Error ? error.message : 'Não foi possível confirmar o pagamento.'
        }

        window.history.replaceState({}, '', `${window.location.pathname}#pagamento`)
      }

      await carregar()
      if (avisoRetorno) {
        if (avisoRetorno === 'Pagamento confirmado com sucesso.' || avisoRetorno.includes('processamento')) {
          setSucesso(avisoRetorno)
        } else {
          setErro(avisoRetorno)
        }
      }
    }

    iniciar()
  }, [token])

  async function assinar(evento: React.FormEvent) {
    evento.preventDefault()
    setAssinando(true)
    setErro('')
    setSucesso('')

    try {
      const resposta = await fetch(`/api/contratos/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, documento, aceite })
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível registrar a assinatura.')

      setSucesso([corpo.mensagem || 'Assinatura registrada com sucesso.', corpo.aviso_pagamento].filter(Boolean).join(' '))
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar a assinatura.')
    } finally {
      setAssinando(false)
    }
  }

  async function copiarPix() {
    if (!contrato?.pagamento.pix_copia_cola) return

    let copiaConcluida = false

    try {
      await navigator.clipboard.writeText(contrato.pagamento.pix_copia_cola)
      copiaConcluida = true
    } catch {
      const campo = document.createElement('textarea')
      campo.value = contrato.pagamento.pix_copia_cola
      campo.setAttribute('readonly', '')
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      campo.setSelectionRange(0, campo.value.length)
      copiaConcluida = document.execCommand('copy')
      document.body.removeChild(campo)
    }

    if (copiaConcluida) {
      setErro('')
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2500)
    } else {
      setErro('Não foi possível copiar automaticamente. Selecione o código Pix abaixo.')
    }
  }

  if (carregando) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Carregando seu contrato...</div>
  }

  if (!contrato) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto text-red-500" size={44} />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Contrato indisponível</h1>
          <p className="mt-2 text-slate-500">{erro || 'Confira o link recebido ou fale com a equipe Cintia Paula.'}</p>
        </div>
      </main>
    )
  }

  const assinado = contrato.status === 'Assinado'
  const pagamento = contrato.pagamento
  const termosEmpresa = contrato.empresa.contrato_padrao
    ?.split(/\n\s*\n/)
    .map(item => item.trim())
    .filter(Boolean) || termosGeraisContrato

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-gradient-to-br from-pink-700 via-pink-600 to-rose-500 px-5 py-9 text-white">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            {contrato.empresa.logo_url ? <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white"><img src={contrato.empresa.logo_url} alt={`Logo ${contrato.empresa.nome}`} className="h-full w-full object-contain p-1" /></span> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-pink-700">CP</span>}
            <div><p className="text-xl font-bold">{contrato.empresa.nome}</p><p className="text-sm text-pink-100">Festas e Decorações</p></div>
          </div>
          <div className="text-right"><p className="text-xs font-bold uppercase tracking-wider text-pink-100">Contrato digital</p><p className="mt-1 text-base font-bold sm:text-lg">{contrato.numero}</p></div>
        </div>
      </header>

      <div className="mx-auto -mt-4 max-w-4xl space-y-5 px-4">
        <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-sm font-semibold text-pink-700">Olá, {contrato.cliente}</p><h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">Contrato de locação</h1><p className="mt-2 text-slate-500">Revise os dados e as condições antes de registrar seu aceite.</p></div>
            <span className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${assinado ? 'bg-green-100 text-green-800' : contrato.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{assinado ? 'Assinado' : contrato.status}</span>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Dados do contratante</p>
            <p className="mt-2 font-semibold text-slate-900">{contrato.contratante.nome}</p>
            <div className="mt-1 space-y-1 text-sm text-slate-600">
              <p>CPF/CNPJ: {contrato.contratante.cpf || 'Não informado'}{contrato.contratante.rg ? ` · RG: ${contrato.contratante.rg}` : ''}</p>
              <p>Contato: {contrato.contratante.whatsapp || 'Não informado'}{contrato.contratante.email ? ` · ${contrato.contratante.email}` : ''}</p>
              <p className="break-words">Endereço completo: {contrato.contratante.endereco || 'Não informado'}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><CalendarDays className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Data do evento</p><p className="font-semibold text-slate-800">{dataCurta(contrato.evento.data)}</p></div></div>
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><Clock3 className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Horário</p><p className="font-semibold text-slate-800">{contrato.evento.horario || 'A combinar'}</p></div></div>
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><PartyPopper className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Kit contratado</p><p className="font-semibold text-slate-800">{contrato.kit.nome}</p>{contrato.kit.codigo && <p className="text-xs text-slate-500">Código {contrato.kit.codigo}</p>}</div></div>
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><MapPin className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Local</p><p className="font-semibold text-slate-800">{contrato.evento.endereco || 'A definir'}</p></div></div>
          </div>
          <Button type="button" variant="secondary" className="mt-5 flex items-center gap-2 print:hidden" onClick={() => window.print()}><Printer size={17} /> Baixar ou imprimir contrato</Button>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-bold text-slate-900">Condições da contratação</h2>
          <div className="mt-5 space-y-5 text-sm leading-7 text-slate-600">
            <div><h3 className="font-bold text-slate-900">1. Objeto</h3><p>Locação dos kits e serviços descritos neste documento para a realização do evento contratado.</p></div>
            <div>
              <h3 className="font-bold text-slate-900">2. Itens contratados</h3>
              <div className="mt-2 overflow-hidden rounded-xl border">
                {(contrato.itens || []).map((item, indice) => <div key={`${item.descricao}-${indice}`} className="flex justify-between gap-3 border-b px-3 py-2 last:border-b-0"><span>{item.quantidade} × {item.descricao}</span><strong>{moeda(item.subtotal)}</strong></div>)}
                {!contrato.itens?.length && <div className="px-3 py-2">1 × {contrato.kit.nome}</div>}
              </div>
            </div>
            <div><h3 className="font-bold text-slate-900">3. Valor</h3><p>O valor total contratado é de <strong>{moeda(contrato.valor_total)}</strong>, com sinal de <strong>{moeda(pagamento.valor_sinal)}</strong>.</p></div>
            <div><h3 className="font-bold text-slate-900">4. Termos e condições</h3><ol className="mt-2 list-decimal space-y-2 pl-5">{termosEmpresa.map(termo => <li key={termo}>{termo}</li>)}</ol></div>
            <div><h3 className="font-bold text-slate-900">5. Cláusulas para locação</h3><ol className="mt-2 list-decimal space-y-2 pl-5">{clausulasLocacaoContrato.map(clausula => <li key={clausula.titulo}><strong>{clausula.titulo}:</strong> {clausula.texto}</li>)}</ol></div>
            <div className="rounded-xl bg-slate-50 p-4 font-semibold text-slate-800">{declaracaoAceiteContrato}</div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          {assinado && contrato.assinatura ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto text-green-600" size={50} />
              <h2 className="mt-4 text-2xl font-bold text-slate-900">Contrato assinado</h2>
              <p className="mt-2 text-slate-500">Aceite registrado em {dataHora(contrato.assinatura.em)} por {contrato.assinatura.nome || contrato.cliente}.</p>
              {contrato.assinatura.documento && <p className="mt-1 text-sm text-slate-400">Documento final {contrato.assinatura.documento}</p>}
              <div className="mx-auto mt-5 flex max-w-lg items-start gap-3 rounded-2xl bg-green-50 p-4 text-left text-sm text-green-800"><ShieldCheck className="mt-0.5 shrink-0" size={20} /><p>O aceite eletrônico e os dados técnicos de auditoria foram vinculados a este contrato.</p></div>
            </div>
          ) : contrato.pode_assinar ? (
            <form onSubmit={assinar} className="mx-auto max-w-xl space-y-4">
              <div className="text-center"><FileSignature className="mx-auto text-pink-600" size={44} /><h2 className="mt-3 text-2xl font-bold text-slate-900">Assinar contrato</h2><p className="mt-2 text-slate-500">Digite os dados do contratante para registrar o aceite eletrônico.</p></div>
              <Input label="Nome completo *" required minLength={2} maxLength={120} autoComplete="name" value={nome} onChange={evento => setNome(evento.target.value)} />
              <Input label="CPF ou CNPJ do contratante *" required inputMode="numeric" minLength={11} maxLength={18} autoComplete="off" value={documento} onChange={evento => setDocumento(evento.target.value)} />
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-slate-50 p-4 text-sm text-slate-700">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-pink-600" checked={aceite} onChange={evento => setAceite(evento.target.checked)} />
                <span>{declaracaoAceiteContrato}</span>
              </label>
              <Button type="submit" disabled={assinando || !aceite} className="flex w-full items-center justify-center gap-2 py-3"><FileSignature size={18} /> {assinando ? 'Registrando assinatura...' : 'Assinar e continuar para o sinal'}</Button>
            </form>
          ) : (
            <div className="text-center"><XCircle className="mx-auto text-red-500" size={44} /><h2 className="mt-4 text-xl font-bold text-slate-900">Contrato indisponível para assinatura</h2><p className="mt-2 text-slate-500">Entre em contato com a equipe Cintia Paula.</p></div>
          )}

          {erro && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
          {sucesso && <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}
        </section>

        {assinado && (
          <section id="pagamento" className={`rounded-3xl border p-6 shadow-sm md:p-8 ${pagamento.pago ? 'border-green-200 bg-green-50' : 'bg-white'}`}>
            {pagamento.pago ? (
              <div className="text-center"><CheckCircle2 className="mx-auto text-green-600" size={48} /><h2 className="mt-3 text-2xl font-bold text-green-900">Sinal confirmado</h2><p className="mt-2 text-green-800">Pagamento recebido. Sua venda está confirmada para a operação.</p></div>
            ) : (
              <>
                <div className="flex items-start gap-3"><CreditCard className="mt-1 shrink-0 text-pink-600" size={24} /><div><h2 className="text-2xl font-bold text-slate-900">Pagamento do sinal</h2><p className="mt-1 text-slate-500">Valor: <strong className="text-slate-900">{moeda(pagamento.valor_sinal)}</strong>{pagamento.vencimento ? ` · vencimento em ${dataCurta(pagamento.vencimento)}` : ''}</p></div></div>

                <div className="mt-6 space-y-4">
                  {pagamento.link && <a href={pagamento.link} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white hover:bg-pink-700"><CreditCard size={18} /> {pagamento.provedor === 'Mercado Pago' ? 'Pagar com Mercado Pago' : 'Abrir pagamento seguro'}</a>}

                  {pagamento.pix_copia_cola && (
                    <div className="rounded-2xl border bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-slate-900">Pix Copia e Cola</p>{pagamento.pix_chave && <p className="text-xs text-slate-500">Chave: {pagamento.pix_chave}</p>}</div><Button variant="secondary" onClick={copiarPix} className="flex shrink-0 items-center gap-2">{copiado ? <Check size={16} /> : <Copy size={16} />}{copiado ? 'Copiado' : 'Copiar Pix'}</Button></div>
                      <p className="mt-4 break-all rounded-xl bg-white p-3 font-mono text-[11px] leading-5 text-slate-500">{pagamento.pix_copia_cola}</p>
                    </div>
                  )}

                  {!pagamento.link && !pagamento.pix_copia_cola && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">A equipe Cintia Paula enviará as instruções de pagamento do sinal.</div>}
                  <p className="text-sm text-slate-500">{pagamento.instrucoes}</p>
                </div>
              </>
            )}
          </section>
        )}

        <footer className="px-4 pt-4 text-center text-xs text-slate-400">{contrato.empresa.nome} · {contrato.numero}</footer>
      </div>
    </main>
  )
}
