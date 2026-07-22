'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const tipos = [
  'Erro',
  'Dificuldade',
  'Sugestão',
  'Elogio'
] as const

type TipoFeedback = typeof tipos[number]

export function FeedbackButton() {
  const pathname = usePathname()

  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] =
    useState<TipoFeedback>('Sugestão')

  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [enviando, setEnviando] = useState(false)

  function fechar() {
    if (enviando) return

    setAberto(false)
    setErro('')
    setSucesso('')
    setMensagem('')
    setTipo('Sugestão')
  }

  async function enviarFeedback(
    evento: React.FormEvent
  ) {
    evento.preventDefault()

    setErro('')
    setSucesso('')

    if (mensagem.trim().length < 5) {
      setErro(
        'Descreva o feedback com pelo menos 5 caracteres.'
      )
      return
    }

    setEnviando(true)

    try {
      const {
        data: { user },
        error: usuarioError
      } = await supabase.auth.getUser()

      if (usuarioError || !user) {
        throw new Error(
          'Sua sessão expirou. Entre novamente no ERP.'
        )
      }

      const {
        data: vinculo,
        error: vinculoError
      } = await supabase
        .from('usuarios_empresa')
        .select('empresa_id')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        .maybeSingle()

      if (vinculoError) {
        console.error(
          'Erro ao localizar empresa do usuário:',
          vinculoError
        )
      }

      const pagina =
        typeof document !== 'undefined'
          ? document.title
          : pathname

      const url =
        typeof window !== 'undefined'
          ? window.location.href
          : pathname

      const { error: feedbackError } =
        await supabase
          .from('feedbacks')
          .insert({
            empresa_id: vinculo?.empresa_id || null,
            usuario_id: user.id,
            tipo,
            mensagem: mensagem.trim(),
            pagina,
            url,
            status: 'Novo',
            prioridade: 'Não classificada'
          })

      if (feedbackError) {
        throw feedbackError
      }

      setMensagem('')
      setSucesso(
        'Feedback enviado com sucesso. Obrigado por ajudar a melhorar o ERP!'
      )

      window.setTimeout(() => {
        fechar()
      }, 1800)
    } catch (error: any) {
      setErro(
        error?.message ||
          'Não foi possível enviar o feedback.'
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErro('')
          setSucesso('')
          setAberto(true)
        }}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-pink-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-pink-700 hover:shadow-xl"
        aria-label="Enviar sugestão"
      >
        💡 Enviar sugestão
      </button>

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          onMouseDown={evento => {
            if (evento.target === evento.currentTarget) {
              fechar()
            }
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-pink-700">
                  CENTRAL DE FEEDBACK
                </p>

                <h2 className="text-xl font-bold text-slate-900">
                  Enviar sugestão
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Conte o que funcionou bem ou o que pode ser
                  melhorado.
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

            <form
              onSubmit={enviarFeedback}
              className="mt-5 space-y-4"
            >
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Tipo de feedback
                </label>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {tipos.map(item => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTipo(item)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        tipo === item
                          ? 'border-pink-500 bg-pink-50 text-pink-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="feedback-mensagem"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Descreva sua experiência
                </label>

                <textarea
                  id="feedback-mensagem"
                  value={mensagem}
                  onChange={evento =>
                    setMensagem(evento.target.value)
                  }
                  placeholder="Ex.: Não encontrei o telefone do cliente na tela da missão..."
                  rows={6}
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:ring-4 focus:ring-pink-50"
                  required
                />

                <p className="mt-1 text-right text-xs text-slate-400">
                  {mensagem.length}/2000
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Página atual: {pathname}
              </div>

              {erro && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erro}
                </div>
              )}

              {sucesso && (
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                  {sucesso}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={fechar}
                  disabled={enviando}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={enviando}
                  className="rounded-xl bg-pink-600 px-5 py-3 text-sm font-bold text-white hover:bg-pink-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {enviando
                    ? 'Enviando...'
                    : 'Enviar feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
