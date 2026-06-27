'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError('E-mail ou senha inválidos.')
    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-pink-50 to-white">
      <form onSubmit={login} className="card w-full max-w-md p-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-pink-700">Cintia Paula</h1>
          <p className="text-sm text-slate-500">Acesse o CRM de festas e decorações</p>
        </div>
        <input className="input" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} type="email" required />
        <input className="input" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} type="password" required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
    </div>
  )
}
