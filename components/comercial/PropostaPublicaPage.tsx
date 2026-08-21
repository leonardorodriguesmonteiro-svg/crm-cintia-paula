'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, FileSignature, MapPin, PartyPopper, ShieldCheck, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type Decisao = 'Aprovado' | 'Recusado'

type Proposta = {
  numero: number
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
  cliente: string
  contato: {
    nome: string
    whatsapp: string
    email: string
  }
  itens: Array<{
    descricao: string
    quantidade: number
    valor_unitario: number
    subtotal: number
  }>
  resposta_cliente: Decisao | null
  respondido_por: string | null
  respondido_em: string | null
  resposta_observacao: string | null
  cadastro_completo: boolean
  cadastro_completo_em: string | null
  bloqueio_temporario_ate: string | null
  formalizacao_status: string | null
  jornada_status: string | null
  pode_responder: boolean
  pode_completar_cadastro: boolean
}

type Cadastro = {
  nome: string
  documento: string
  whatsapp: string
  email: string
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

const cadastroVazio: Cadastro = {
  nome: '',
  documento: '',
  whatsapp: '',
  email: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: ''
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataCurta(valor: string | null) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function dataHora(valor: string | null) {
  if (!valor) return '-'
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function PropostaPublicaPage({ token }: { token: string }) {
  const [proposta, setProposta] = useState<Proposta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [salvandoCadastro, setSalvandoCadastro] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [decisao, setDecisao] = useState<Decisao | null>(null)
  const [nome, setNome] = useState('')
  const [observacao, setObservacao] = useState('')
  const [cadastro, setCadastro] = useState<Cadastro>(cadastroVazio)

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const resposta = await fetch(`/api/propostas/${token}`, { cache: 'no-store' })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível carregar a proposta.')
      setProposta(corpo.proposta)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar a proposta.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [token])

  useEffect(() => {
    if (!proposta?.contato) return

    setCadastro(atual => ({
      ...atual,
      nome: atual.nome || proposta.contato.nome || '',
      whatsapp: atual.whatsapp || proposta.contato.whatsapp || '',
      email: atual.email || proposta.contato.email || ''
    }))
    setNome(atual => atual || proposta.contato.nome || '')
  }, [proposta?.contato])

  async function responder(evento: React.FormEvent) {
    evento.preventDefault()
    if (!decisao) return

    setEnviando(true)
    setErro('')
    setSucesso('')

    try {
      const resposta = await fetch(`/api/propostas/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, nome, observacao })
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível registrar sua resposta.')

      setSucesso(corpo.mensagem)
      setDecisao(null)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar sua resposta.')
    } finally {
      setEnviando(false)
    }
  }

  function atualizarCadastro(campo: keyof Cadastro, valor: string) {
    setCadastro(atual => ({ ...atual, [campo]: valor }))
  }

  async function completarCadastro(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvandoCadastro(true)
    setErro('')
    setSucesso('')

    try {
      const resposta = await fetch(`/api/propostas/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cadastro)
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível concluir o cadastro.')

      setSucesso(corpo.mensagem)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.')
    } finally {
      setSalvandoCadastro(false)
    }
  }

  if (carregando) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">Carregando sua proposta...</div>
  }

  if (!proposta) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto text-red-500" size={42} />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Proposta indisponível</h1>
          <p className="mt-2 text-slate-500">{erro || 'Confira o link recebido ou fale com a equipe Cintia Paula.'}</p>
        </div>
      </main>
    )
  }

  const protocolo = `ORC-${String(proposta.numero).padStart(4, '0')}`
  const respondida = proposta.resposta_cliente || (['Aprovado', 'Recusado'].includes(proposta.status) ? proposta.status as Decisao : null)

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-gradient-to-br from-pink-700 via-pink-600 to-rose-500 px-5 py-9 text-white">
        <div className="mx-auto flex max-w-4xl items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-pink-700">CP</span>
            <div>
              <p className="text-xl font-bold">Cintia Paula</p>
              <p className="text-sm text-pink-100">Festas e Decorações</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-pink-100">Proposta comercial</p>
            <p className="mt-1 text-lg font-bold">{protocolo}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto -mt-4 max-w-4xl space-y-5 px-4">
        <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold text-pink-700">Olá, {proposta.cliente}</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 md:text-3xl">Sua festa começa por aqui</h1>
          <p className="mt-2 text-slate-500">Confira todos os detalhes antes de responder. Esta proposta é válida até {dataCurta(proposta.validade)}.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><CalendarDays className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Data do evento</p><p className="font-semibold text-slate-800">{dataCurta(proposta.data_evento)}</p></div></div>
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><Clock3 className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Horário</p><p className="font-semibold text-slate-800">{proposta.horario_evento || 'A combinar'}</p></div></div>
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><PartyPopper className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Retirada e devolução</p><p className="font-semibold text-slate-800">{dataCurta(proposta.data_retirada)} a {dataCurta(proposta.data_devolucao)}</p></div></div>
            <div className="flex gap-3 rounded-2xl bg-slate-50 p-4"><MapPin className="shrink-0 text-pink-600" size={20} /><div><p className="text-xs font-bold uppercase text-slate-400">Local</p><p className="font-semibold text-slate-800">{proposta.endereco_evento || 'A definir'}</p></div></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
          <div className="border-b px-6 py-5"><h2 className="text-xl font-bold text-slate-900">Itens da proposta</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-900 text-white"><tr><th className="px-6 py-3">Descrição</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3 text-right">Unitário</th><th className="px-6 py-3 text-right">Subtotal</th></tr></thead>
              <tbody>{proposta.itens.map((item, indice) => <tr key={`${item.descricao}-${indice}`} className="border-b last:border-0"><td className="px-6 py-4 font-medium text-slate-800">{item.descricao}</td><td className="px-4 py-4 text-right text-slate-600">{item.quantidade.toLocaleString('pt-BR')}</td><td className="px-4 py-4 text-right text-slate-600">{moeda(item.valor_unitario)}</td><td className="px-6 py-4 text-right font-bold text-slate-900">{moeda(item.subtotal)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-6 border-t bg-pink-50/60 p-6 md:grid-cols-[1fr_320px]">
            <div>{proposta.observacoes && <><p className="text-xs font-bold uppercase text-slate-500">Observações</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{proposta.observacoes}</p></>}</div>
            <div className="space-y-2 text-sm"><p className="flex justify-between"><span>Subtotal</span><strong>{moeda(proposta.subtotal)}</strong></p><p className="flex justify-between"><span>Desconto</span><strong>- {moeda(proposta.desconto)}</strong></p><p className="flex justify-between"><span>Acréscimos</span><strong>{moeda(proposta.acrescimos)}</strong></p><p className="flex justify-between"><span>Frete / entrega</span><strong>{moeda(proposta.frete)}</strong></p><p className="mt-3 flex items-end justify-between border-t border-pink-200 pt-3 text-pink-700"><span className="font-bold">Total</span><strong className="text-2xl">{moeda(proposta.total)}</strong></p></div>
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow-sm md:p-8">
          {respondida ? (
            <div>
              <div className="text-center">
                {respondida === 'Aprovado' ? <CheckCircle2 className="mx-auto text-green-600" size={48} /> : <XCircle className="mx-auto text-red-500" size={48} />}
                <h2 className="mt-4 text-2xl font-bold text-slate-900">Proposta {respondida === 'Aprovado' ? 'aprovada' : 'recusada'}</h2>
                <p className="mt-2 text-slate-500">Resposta registrada em {dataHora(proposta.respondido_em)}{proposta.respondido_por ? ` por ${proposta.respondido_por}` : ''}.</p>
                {proposta.resposta_observacao && <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">{proposta.resposta_observacao}</p>}
              </div>

              {respondida === 'Aprovado' && proposta.pode_completar_cadastro && (
                <form onSubmit={completarCadastro} className="mx-auto mt-8 max-w-2xl space-y-5 rounded-3xl border border-pink-100 bg-pink-50/50 p-5 md:p-6">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 shrink-0 text-pink-600" size={24} />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Complete os dados para o contrato</h3>
                      <p className="mt-1 text-sm text-slate-600">Agora solicitamos somente os dados necessários para formalizar a contratação. A reserva ainda não está confirmada.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Input label="Nome completo *" required value={cadastro.nome} onChange={evento => atualizarCadastro('nome', evento.target.value)} />
                    <Input label="CPF ou CNPJ *" required value={cadastro.documento} onChange={evento => atualizarCadastro('documento', evento.target.value)} />
                    <Input label="WhatsApp com DDD *" required value={cadastro.whatsapp} onChange={evento => atualizarCadastro('whatsapp', evento.target.value)} />
                    <Input label="E-mail *" type="email" required value={cadastro.email} onChange={evento => atualizarCadastro('email', evento.target.value)} />
                    <Input label="CEP *" required value={cadastro.cep} onChange={evento => atualizarCadastro('cep', evento.target.value)} />
                    <Input label="Logradouro *" required value={cadastro.endereco} onChange={evento => atualizarCadastro('endereco', evento.target.value)} />
                    <Input label="Número *" required value={cadastro.numero} onChange={evento => atualizarCadastro('numero', evento.target.value)} />
                    <Input label="Complemento" value={cadastro.complemento} onChange={evento => atualizarCadastro('complemento', evento.target.value)} />
                    <Input label="Bairro *" required value={cadastro.bairro} onChange={evento => atualizarCadastro('bairro', evento.target.value)} />
                    <Input label="Cidade *" required value={cadastro.cidade} onChange={evento => atualizarCadastro('cidade', evento.target.value)} />
                    <Input label="UF *" required maxLength={2} value={cadastro.estado} onChange={evento => atualizarCadastro('estado', evento.target.value.toUpperCase())} />
                  </div>

                  <div className="rounded-2xl bg-white px-4 py-3 text-xs leading-5 text-slate-500">
                    Seus dados serão usados para identificação do contratante e geração do contrato. A confirmação da reserva ocorrerá após assinatura digital e pagamento do sinal previsto.
                  </div>

                  <Button type="submit" disabled={salvandoCadastro} className="flex w-full items-center justify-center gap-2 py-3">
                    <FileSignature size={18} /> {salvandoCadastro ? 'Salvando dados...' : 'Confirmar dados e seguir para o contrato'}
                  </Button>
                </form>
              )}

              {respondida === 'Aprovado' && proposta.cadastro_completo && (
                <div className="mx-auto mt-8 max-w-2xl rounded-3xl border border-green-100 bg-green-50 p-6 text-center">
                  <ShieldCheck className="mx-auto text-green-600" size={38} />
                  <h3 className="mt-3 text-lg font-bold text-slate-900">Dados contratuais recebidos</h3>
                  <p className="mt-2 text-sm text-slate-600">A equipe Cintia Paula seguirá com a geração e o envio do contrato. A reserva será confirmada após a assinatura digital e o pagamento.</p>
                </div>
              )}
            </div>
          ) : proposta.pode_responder ? (
            <div>
              <div className="text-center"><h2 className="text-2xl font-bold text-slate-900">O que achou da proposta?</h2><p className="mt-2 text-slate-500">A aprovação confirma os valores e inicia a contratação. A reserva será confirmada somente após contrato e pagamento.</p></div>
              {!decisao ? (
                <div className="mx-auto mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
                  <Button onClick={() => setDecisao('Aprovado')} className="flex items-center justify-center gap-2 py-3"><CheckCircle2 size={19} /> Aprovar proposta</Button>
                  <Button variant="danger" onClick={() => setDecisao('Recusado')} className="flex items-center justify-center gap-2 py-3"><XCircle size={19} /> Recusar proposta</Button>
                </div>
              ) : (
                <form onSubmit={responder} className="mx-auto mt-6 max-w-xl space-y-4 rounded-2xl bg-slate-50 p-5">
                  <div className={`rounded-xl px-4 py-3 text-sm font-bold ${decisao === 'Aprovado' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>Você selecionou: {decisao === 'Aprovado' ? 'Aprovar proposta' : 'Recusar proposta'}</div>
                  <Input label="Seu nome *" required minLength={2} maxLength={120} value={nome} onChange={evento => setNome(evento.target.value)} />
                  <Textarea label="Mensagem para a equipe (opcional)" rows={4} maxLength={1000} value={observacao} onChange={evento => setObservacao(evento.target.value)} />
                  <div className="flex flex-col gap-2 sm:flex-row"><Button type="submit" disabled={enviando}>{enviando ? 'Registrando...' : `Confirmar ${decisao === 'Aprovado' ? 'aprovação' : 'recusa'}`}</Button><Button type="button" variant="secondary" disabled={enviando} onClick={() => setDecisao(null)}>Voltar</Button></div>
                </form>
              )}
            </div>
          ) : (
            <div className="text-center"><Clock3 className="mx-auto text-amber-500" size={44} /><h2 className="mt-4 text-2xl font-bold text-slate-900">Esta proposta não aceita mais respostas</h2><p className="mt-2 text-slate-500">Entre em contato com a equipe Cintia Paula para receber uma proposta atualizada.</p></div>
          )}

          {erro && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
          {sucesso && <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}
        </section>

        <footer className="px-4 pt-4 text-center text-xs text-slate-400">Cintia Paula Festas e Decorações · Proposta {protocolo}</footer>
      </div>
    </main>
  )
}
