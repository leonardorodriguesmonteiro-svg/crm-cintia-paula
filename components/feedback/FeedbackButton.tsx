'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const tipos = ['Erro', 'Dificuldade', 'Sugestão', 'Elogio'] as const
const respostaAutomatica =
  'Recebemos seu feedback e ele já foi registrado para análise. Você pode acompanhar o andamento por esta Central.'

type TipoFeedback = (typeof tipos)[number]
type AbaFeedback = 'enviar' | 'acompanhar'

type FeedbackUsuario = {
  id: string
  tipo: string
  mensagem: string
  status: string
  prioridade: string
  resposta: string | null
  resolvido_em: string | null
  created_at: string
}

function protocolo(id: string) {
  return `FB-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

function corStatus(status: string) {
  if (status === 'Concluído') return 'bg-green-100 text-green-800'
  if (status === 'Descartado') return 'bg-slate-200 text-slate-700'
  if (status === 'Em desenvolvimento') return 'bg-purple-100 text-purple-800'
  if (status === 'Planejado') return 'bg-blue-100 text-blue-800'
  if (status === 'Em análise') return 'bg-yellow-100 text-yellow-800'
  return 'bg-pink-100 text-pink-800'
}

export function FeedbackButton() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [aba, setAba] = useState<AbaFeedback>('enviar')
  const [tipo, setTipo] = useState<TipoFeedback>('Sugestão')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [meusFeedbacks, setMeusFeedbacks] = useState<FeedbackUsuario[]>([])

  async function carregarMeusFeedbacks() {
    setCarregando(true)
    setErro('')

    const {
      data: { user },
      error: usuarioError
    } = await supabase.auth.getUser()

    if (usuarioError || !user) {
      setErro('Sua sessão expirou. Entre novamente no ERP.')
      setCarregando(false)
      return
    }

    const { data, error } = await supabase
      .from('feedbacks')
      .select('id,tipo,mensagem,status,prioridade,resposta,resolvido_em,created_at')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      setErro(error.message)
    } else {
      setMeusFeedbacks(data || [])
    }

    setCarregando(false)
  }

  async function abrir(novaAba: AbaFeedback = 'enviar') {
    setErro('')
    setSucesso('')
    setAba(novaAba)
    setAberto(true)

    if (novaAba === 'acompanhar') {
      await carregarMeusFeedbacks()
    }
  }

  function fechar() {
    if (enviando) return
    setAberto(false)
    setErro('')
    setSucesso('')
    setMensagem('')
    setTipo('Sugestão')
  }

  async function selecionarAba(novaAba: AbaFeedback) {
    setAba(novaAba)
    setErro('')

    if (novaAba === 'acompanhar') {
      await carregarMeusFeedbacks()
    }
  }

  async function enviarFeedback(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (mensagem.trim().length < 5) {
      setErro('Descreva o feedback com pelo menos 5 caracteres.')
      return
    }

    setEnviando(true)

    try {
      const {
        data: { user },
        error: usuarioError
      } = await supabase.auth.getUser()

      if (usuarioError || !user) {
        throw new Error('Sua sessão expirou. Entre novamente no ERP.')
      }

      const { data: vinculo, error: vinculoError } = await supabase
        .from('usuarios_empresa')
        .select('empresa_id')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        .maybeSingle()

      if (vinculoError) {
        console.error('Erro ao localizar empresa do usuário:', vinculoError)
      }

      const pagina = typeof document !== 'undefined' ? document.title : pathname
      const url = typeof window !== 'undefined' ? window.location.href : pathname

      const { data: feedback, error: feedbackError } = await supabase
        .from('feedbacks')
        .insert({
          empresa_id: vinculo?.empresa_id || null,
          usuario_id: user.id,
          tipo,
          mensagem: mensagem.trim(),
          pagina,
          url,
          status: 'Novo',
          prioridade: 'Não classificada',
          resposta: respostaAutomatica
        })
        .select('id,tipo,mensagem,status,prioridade,resposta,resolvido_em,created_at')
        .single()

      if (feedbackError) throw feedbackError

      setMensagem('')
      setMeusFeedbacks(atuais => [feedback, ...atuais.filter(item => item.id !== feedback.id)])
      setSucesso(`Feedback recebido. Protocolo ${protocolo(feedback.id)}.`)
      setAba('acompanhar')
    } catch (error: any) {
      setErro(error?.message || 'Não foi possível enviar o feedback.')
    } finally {
      setEnviando(false)
    }
  }

  if (pathname === '/login' || pathname === '/redefinir-senha') {
    return null
  }

  return (
    <>
      <button
        type="button"
        onClick={() => abrir('enviar')}
        className="fixed bottom-24 right-4 z-[60] rounded-full bg-pink-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-pink-700 hover:shadow-xl md:bottom-5 md:right-5"
        aria-label="Abrir Central de Feedback"
      >
        💡 Feedbacks
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          onMouseDown={evento => {
            if (evento.target === evento.currentTarget) fechar()
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-pink-700">CENTRAL DE FEEDBACK</p>
                <h2 className="text-xl font-bold text-slate-900">Sua opinião melhora o ERP</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Envie uma ideia e acompanhe a resposta da administração.
                </p>
              </div>

              <button
                type="button"
                onClick={fechar}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => selecionarAba('enviar')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${aba === 'enviar' ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-500'}`}
              >
                Enviar feedback
              </button>
              <button
                type="button"
                onClick={() => selecionarAba('acompanhar')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${aba === 'acompanhar' ? 'bg-white text-pink-700 shadow-sm' : 'text-slate-500'}`}
              >
                Meus feedbacks
              </button>
            </div>

            {erro && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
            {sucesso && <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{sucesso}</div>}

            {aba === 'enviar' ? (
              <form onSubmit={enviarFeedback} className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tipo de feedback</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {tipos.map(item => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setTipo(item)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${tipo === item ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="feedback-mensagem" className="mb-2 block text-sm font-semibold text-slate-700">
                    Descreva sua experiência
                  </label>
                  <textarea
                    id="feedback-mensagem"
                    value={mensagem}
                    onChange={evento => setMensagem(evento.target.value)}
                    placeholder="Ex.: Não encontrei o telefone do cliente na tela da missão..."
                    rows={6}
                    maxLength={2000}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-50"
                    required
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{mensagem.length}/2000</p>
                </div>

                <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">Página atual: {pathname}</div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={fechar} disabled={enviando} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    Cancelar
                  </button>
                  <button type="submit" disabled={enviando} className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-wait disabled:opacity-60">
                    {enviando ? 'Enviando...' : 'Enviar feedback'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-5 space-y-3">
                {carregando && <div className="rounded-2xl border p-6 text-center text-sm text-slate-500">Carregando seus feedbacks...</div>}

                {!carregando && meusFeedbacks.map(item => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-pink-700">{protocolo(item.id)}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{item.tipo}</span>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${corStatus(item.status)}`}>{item.status}</span>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{item.mensagem}</p>

                    {item.resposta && (
                      <div className="mt-3 rounded-xl bg-pink-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-pink-700">Resposta da administração</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.resposta}</p>
                      </div>
                    )}

                    <p className="mt-3 text-xs text-slate-400">
                      Enviado em {new Date(item.created_at).toLocaleString('pt-BR')}
                    </p>
                  </article>
                ))}

                {!carregando && meusFeedbacks.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
                    Você ainda não enviou feedbacks.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
