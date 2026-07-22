'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function RedefinirSenhaPage() {
  const router = useRouter()

  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [carregandoLink, setCarregandoLink] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sessaoValida, setSessaoValida] = useState(false)

  useEffect(() => {
    let ativo = true

    async function verificarSessao() {
      const parametros = new URLSearchParams(window.location.search)
      const erroUrl =
        parametros.get('error_description') ||
        parametros.get('error')

      if (erroUrl) {
        if (ativo) {
          setErro(
            'O link de recuperação é inválido ou expirou. Solicite um novo e-mail.'
          )
          setCarregandoLink(false)
        }
        return
      }

      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (ativo && session) {
        setSessaoValida(true)
        setCarregandoLink(false)
      }
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((evento, session) => {
      if (!ativo) return

      if (
        evento === 'PASSWORD_RECOVERY' ||
        (evento === 'SIGNED_IN' && session)
      ) {
        setSessaoValida(true)
        setErro('')
        setCarregandoLink(false)
      }
    })

    verificarSessao()

    const limite = window.setTimeout(() => {
      if (ativo) {
        setCarregandoLink(false)
      }
    }, 5000)

    return () => {
      ativo = false
      window.clearTimeout(limite)
      subscription.unsubscribe()
    }
  }, [])

  async function redefinirSenha(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')
    setMensagem('')

    if (senha.length < 8) {
      setErro('A nova senha deve possuir pelo menos 8 caracteres.')
      return
    }

    if (senha !== confirmacao) {
      setErro('A confirmação da senha está diferente.')
      return
    }

    setSalvando(true)

    const { error } = await supabase.auth.updateUser({
      password: senha
    })

    if (error) {
      setErro(
        error.message ||
          'Não foi possível redefinir a senha. Solicite um novo link.'
      )
      setSalvando(false)
      return
    }

    setMensagem('Senha redefinida com sucesso. Redirecionando para o login...')

    await supabase.auth.signOut()

    window.setTimeout(() => {
      router.replace('/login')
    }, 1800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-pink-50 to-white">
      <div className="card w-full max-w-md p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-pink-700">
            Nova senha
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Cadastre uma nova senha de acesso ao ERP Festas.
          </p>
        </div>

        {carregandoLink && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Validando o link de recuperação...
          </div>
        )}

        {!carregandoLink && !sessaoValida && (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro ||
                'O link de recuperação não possui uma sessão válida. Solicite um novo e-mail.'}
            </div>

            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => router.replace('/login')}
            >
              Voltar para o login
            </button>
          </div>
        )}

        {!carregandoLink && sessaoValida && (
          <form onSubmit={redefinirSenha} className="space-y-5">
            <input
              className="input"
              placeholder="Nova senha"
              value={senha}
              onChange={evento => setSenha(evento.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />

            <input
              className="input"
              placeholder="Confirmar nova senha"
              value={confirmacao}
              onChange={evento => setConfirmacao(evento.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />

            {erro && (
              <p className="text-sm text-red-600">
                {erro}
              </p>
            )}

            {mensagem && (
              <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                {mensagem}
              </p>
            )}

            <button
              className="btn-primary w-full"
              disabled={salvando}
            >
              {salvando
                ? 'Salvando nova senha...'
                : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
