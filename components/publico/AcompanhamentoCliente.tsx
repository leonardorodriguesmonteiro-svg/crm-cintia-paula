'use client'
import { CadastroPreReserva } from './CadastroPreReserva'
import { useCallback, useEffect, useRef, useState } from 'react'

type Pedido = {
  cadastro: { completo: boolean; disponivel: boolean };
  numero: number; etapa: string; data_evento: string | null;
  proposta: { status: string; formalizacao: string; url: string | null } | null;
  contrato: { status: string; url: string | null } | null;
  reserva: { status: string; status_operacional: string; status_pagamento: string; data_retirada: string | null; data_devolucao: string | null } | null;
}
const rotulos: Record<string, string> = {
  RECEBIDA: 'Solicitação recebida', EM_ANALISE: 'Em análise', AJUSTE_SOLICITADO: 'Ajuste solicitado',
  APROVADA: 'Solicitação aprovada para proposta', RECUSADA: 'Recusada', CONVERTIDA_EM_PROPOSTA: 'Preparação da proposta',
  RASCUNHO: 'Em preparação', ENVIADA: 'Enviada', ACEITA: 'Aceita', EXPIRADA: 'Expirada', CANCELADA: 'Cancelada',
  AGUARDANDO_DADOS: 'Aguardando seus dados', DADOS_COMPLETOS: 'Dados recebidos', CONTRATO_GERADO: 'Contrato em preparação',
  CONTRATO_ENVIADO: 'Contrato enviado', AGUARDANDO_ASSINATURA: 'Aguardando assinatura', AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
  PRONTA_PARA_CONFIRMAR: 'Aguardando confirmação da equipe', RESERVA_CONFIRMADA: 'Reserva confirmada'
}
const rotulo = (valor: string | null) => valor ? rotulos[valor] || valor : 'Ainda não iniciado'
const data = (valor: string | null) => valor ? new Date(`${valor.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : 'A combinar'

export function AcompanhamentoCliente() {
  const [linkInformado, setLinkInformado] = useState('')
  const [temLink, setTemLink] = useState(false)
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [atualizado, setAtualizado] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const atualizar = useCallback(async () => {
    if (controller.current) return
    const token = window.location.hash.slice(1)
    setTemLink(Boolean(token))
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      setErro(token ? 'O link está incompleto. Cole o link privado completo recebido na confirmação ou enviado pela equipe.' : '')
      setPedido(null); setCarregando(false); return
    }
    const abort = new AbortController()
    controller.current = abort
    setCarregando(true)
    try {
      const resposta = await fetch('/api/publico/acompanhamento', { method: 'POST', cache: 'no-store', signal: abort.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const corpo = await resposta.json()
      if (!resposta.ok) { setPedido(null); throw new Error(corpo.erro || 'Não foi possível consultar o pedido.') }
      setPedido(corpo); setErro(''); setAtualizado(new Date().toLocaleTimeString('pt-BR'))
    } catch (error) {
      if (!abort.signal.aborted) { setPedido(null); setErro(error instanceof Error ? error.message : 'Falha de conexão. Tente novamente.') }
    } finally { if (controller.current === abort) controller.current = null; if (!abort.signal.aborted) setCarregando(false) }
  }, [])
  useEffect(() => {
    void atualizar()
    const visivel = () => { if (document.visibilityState === 'visible') void atualizar() }
    const novoLink = () => { controller.current?.abort(); controller.current = null; setPedido(null); void atualizar() }
    const intervalo = window.setInterval(visivel, 60000)
    window.addEventListener('hashchange', novoLink)
    document.addEventListener('visibilitychange', visivel)
    return () => { window.clearInterval(intervalo); controller.current?.abort(); controller.current = null; window.removeEventListener('hashchange', novoLink); document.removeEventListener('visibilitychange', visivel) }
  }, [atualizar])
  function abrirLink(event: React.FormEvent) {
    event.preventDefault()
    try {
      const url = new URL(linkInformado.trim())
      if (url.protocol !== 'https:' || !['www.cintiapaulafestaedecoracao.com.br', 'cintiapaulafestaedecoracao.com.br'].includes(url.hostname) || url.pathname !== '/acompanhar' || url.port || url.username || url.password || !/^[A-Za-z0-9_-]{43}$/.test(url.hash.slice(1))) throw new Error()
      if (window.location.hash === url.hash) void atualizar()
      else window.location.hash = url.hash
      setLinkInformado('')
    } catch { setErro('Cole o link completo de acompanhamento da Cintia Paula. Se não o tiver, entre em contato com a equipe.') }
  }
  return <main className="min-h-screen bg-pink-50 px-4 py-10 text-slate-900">
    <div className="mx-auto max-w-2xl space-y-5">
      <a href="/" className="text-sm font-bold text-pink-700">Cintia Paula Festas &amp; Decorações</a>
      <h1 className="text-3xl font-bold">Acompanhe seu pedido</h1>
      <p className="text-base text-slate-600">Consulte as atualizações da equipe e os documentos liberados para você.</p>
      {!pedido && !carregando && <form onSubmit={abrirLink} className="space-y-4 rounded-2xl border border-pink-100 bg-white p-6">
        <h2 className="text-xl font-bold">Abra seu acompanhamento</h2>
        <p className="leading-7 text-slate-600">Cole o link privado que apareceu ao enviar sua solicitação ou que a equipe enviou para você.</p>
        <label htmlFor="link-pedido" className="block font-bold">Link do pedido</label>
        <input id="link-pedido" type="url" required autoComplete="off" value={linkInformado} onChange={e => setLinkInformado(e.target.value)} placeholder="https://www.cintiapaulafestaedecoracao.com.br/acompanhar#…" className="w-full rounded-xl border border-slate-300 p-3 text-base" />
        <button className="rounded-xl bg-pink-600 px-5 py-3 font-bold text-white" type="submit">Consultar meu pedido</button>
        <p className="text-sm leading-6 text-slate-600">Não recebeu ou perdeu o link? <a className="font-bold text-pink-700 underline" href="/contato">Fale com a equipe</a> e informe o número do pedido. Para proteger seus dados, o número sozinho não abre a consulta.</p>
      </form>}
      {erro && <p role="alert" className="rounded-2xl border border-amber-200 bg-white p-5">{erro}</p>}
      {temLink && <div className="flex flex-wrap items-center gap-3"><button disabled={carregando} onClick={() => void atualizar()} className="rounded-xl bg-pink-600 px-5 py-3 font-bold text-white disabled:opacity-60">{carregando ? 'Consultando…' : 'Atualizar andamento'}</button><span role="status" className="text-sm text-slate-600">{atualizado && pedido ? `Consultado às ${atualizado}` : ''}</span></div>}
      {pedido && <>
        {pedido.cadastro?.disponivel && <CadastroPreReserva onConcluido={() => void atualizar()} />}
        {pedido.cadastro?.completo && <p role="status" className="rounded-2xl bg-green-50 p-5 text-green-900">Cadastro recebido. A equipe preparará o orçamento final; você poderá acessá-lo nesta página quando for enviado.</p>}
        <section className="rounded-2xl border border-pink-100 bg-white p-6"><p className="text-sm font-bold text-pink-700">Pedido #{String(pedido.numero).padStart(4, '0')}</p><h2 className="mt-2 text-xl font-bold">{rotulo(pedido.etapa)}</h2><p className="mt-3">Data do evento: {data(pedido.data_evento)}</p></section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Proposta</h2><p className="mt-2">{pedido.proposta ? rotulo(pedido.proposta.status) : 'A equipe ainda não liberou uma proposta.'}</p>{pedido.proposta?.url && <a className="mt-4 inline-block rounded-xl border border-pink-300 px-4 py-3 font-bold text-pink-700" href={pedido.proposta.url}>Abrir proposta</a>}</section>
        <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Contrato e confirmação</h2><p className="mt-2">{pedido.proposta ? rotulo(pedido.proposta.formalizacao) : 'Após a análise e o aceite da proposta.'}</p>{pedido.contrato && <p className="mt-2">Contrato: {rotulo(pedido.contrato.status)}</p>}{pedido.contrato?.url && <a className="mt-4 inline-block rounded-xl border border-pink-300 px-4 py-3 font-bold text-pink-700" href={pedido.contrato.url}>Abrir contrato</a>}</section>
        {pedido.reserva && <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Reserva e entrega</h2><dl className="mt-4 grid grid-cols-2 gap-3"><dt>Reserva</dt><dd>{rotulo(pedido.reserva.status)}</dd><dt>Pagamento registrado</dt><dd>{rotulo(pedido.reserva.status_pagamento)}</dd><dt>Operação</dt><dd>{rotulo(pedido.reserva.status_operacional)}</dd><dt>Retirada prevista</dt><dd>{data(pedido.reserva.data_retirada)}</dd><dt>Devolução prevista</dt><dd>{data(pedido.reserva.data_devolucao)}</dd></dl></section>}
        <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">O recebimento da solicitação não confirma a reserva. As condições finais, os pagamentos e a confirmação seguem a formalização com a equipe.</p>
      </>}
      <p className="text-sm text-slate-600">Este link é privado. Guarde-o para voltar a esta página.</p>
    </div>
  </main>
}
