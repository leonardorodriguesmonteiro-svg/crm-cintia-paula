'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    setLoading(false)

    if (error) {
      setError('E-mail ou senha inválidos.')
      return
    }

    router.replace('/dashboard')
  }

  async function recuperarSenha() {
    setError('')
    setMessage('')

    if (!email.trim()) {
      setError(
        'Digite o e-mail cadastrado antes de solicitar a recuperação.'
      )
      return
    }

    setSendingReset(true)

    const redirectTo =
      `${window.location.origin}/redefinir-senha`

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      )

    setSendingReset(false)

    if (error) {
      setError(
        error.message ||
          'Não foi possível enviar o e-mail de recuperação.'
      )
      return
    }

    setMessage(
      'Enviamos um link de recuperação. Verifique a caixa de entrada e também a pasta de spam.'
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-pink-50 to-white">
      <form
        onSubmit={login}
        className="card w-full max-w-md p-8 space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-pink-700">
            Cintia Paula
          </h1>

          <p className="text-sm text-slate-500">
            Acesse o ERP de festas e decorações
          </p>
        </div>

        <input
          className="input"
          placeholder="E-mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          required
        />

        <input
          className="input"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          required
        />

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        {message && (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </p>
        )}

        <button
          className="btn-primary w-full"
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <button
          type="button"
          onClick={recuperarSenha}
          disabled={sendingReset}
          className="w-full text-sm font-semibold text-pink-700 hover:text-pink-800 disabled:opacity-60"
        >
          {sendingReset
            ? 'Enviando e-mail...'
            : 'Esqueci minha senha'}
        </button>
      </form>
    </div>
  )
}
