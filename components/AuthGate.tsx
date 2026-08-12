'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { moduloDaRota } from '@/lib/access'
import { useAcesso } from '@/components/auth/AcessoContext'

const rotasPublicas = [
  '/login',
  '/redefinir-senha'
]

export function AuthGate({
  children
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { acesso, carregar, limpar } = useAcesso()
  const [verificando, setVerificando] = useState(true)
  const [acessoNegado, setAcessoNegado] = useState('')

  const rotaPublica = rotasPublicas.some(
    rota =>
      pathname === rota ||
      pathname.startsWith(`${rota}/`)
  )

  useEffect(() => {
    let ativo = true

    if (rotaPublica) {
      setAcessoNegado('')
      setVerificando(false)
      return
    }

    setAcessoNegado('')
    setVerificando(true)

    async function verificarSessao() {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!ativo) return

      if (!session) {
        limpar()
        router.replace('/login')
        return
      }

      const acessoAtual = await carregar()
      if (!ativo) return

      if (!acessoAtual?.ativo) {
        setAcessoNegado('Seu usuário não possui um vínculo ativo com a empresa. Fale com um administrador.')
        setVerificando(false)
        return
      }

      const modulo = moduloDaRota(pathname)
      if (modulo && !acessoAtual.permissoes.includes(modulo)) {
        setAcessoNegado('Seu perfil não possui permissão para acessar este módulo.')
        setVerificando(false)
        return
      }

      setAcessoNegado('')
      setVerificando(false)
    }

    verificarSessao()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (evento, session) => {
        if (!ativo) return

        if (evento === 'SIGNED_OUT' || !session) {
          limpar()
          router.replace('/login')
          return
        }
      }
    )

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [rotaPublica, router, pathname, carregar, limpar])

  if (rotaPublica) {
    return <>{children}</>
  }

  if (verificando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Verificando acesso...
        </p>
      </div>
    )
  }

  if (acessoNegado || !acesso) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-pink-700">Acesso restrito</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Permissão necessária</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{acessoNegado || 'Não foi possível identificar seu acesso à empresa.'}</p>
          <button type="button" onClick={() => router.replace('/dashboard')} className="mt-6 rounded-xl bg-pink-600 px-5 py-3 text-sm font-semibold text-white">Voltar ao início</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
