'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const [verificando, setVerificando] = useState(true)

  const rotaPublica = rotasPublicas.some(
    rota =>
      pathname === rota ||
      pathname.startsWith(`${rota}/`)
  )

  useEffect(() => {
    let ativo = true

    if (rotaPublica) {
      setVerificando(false)
      return
    }

    async function verificarSessao() {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!ativo) return

      if (!session) {
        router.replace('/login')
        return
      }

      setVerificando(false)
    }

    verificarSessao()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(
      (evento, session) => {
        if (!ativo) return

        if (evento === 'SIGNED_OUT' || !session) {
          router.replace('/login')
          return
        }

        setVerificando(false)
      }
    )

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [rotaPublica, router])

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

  return <>{children}</>
}
