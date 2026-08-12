'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AcessoAtual, ModuloAcesso } from '@/lib/access'

type EstadoAcesso = {
  acesso: AcessoAtual | null
  carregando: boolean
  erro: string
  carregar: () => Promise<AcessoAtual | null>
  limpar: () => void
  pode: (modulo: ModuloAcesso) => boolean
}

const AcessoContext = createContext<EstadoAcesso | null>(null)

export function AcessoProvider({ children }: { children: React.ReactNode }) {
  const [acesso, setAcesso] = useState<AcessoAtual | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase.rpc('meu_acesso')

    if (error) {
      setAcesso(null)
      setErro(error.message)
      setCarregando(false)
      return null
    }

    const proximo = data && typeof data === 'object' ? data as AcessoAtual : null
    setAcesso(proximo)
    setCarregando(false)
    return proximo
  }, [])

  const limpar = useCallback(() => {
    setAcesso(null)
    setErro('')
    setCarregando(false)
  }, [])

  const valor = useMemo<EstadoAcesso>(() => ({
    acesso,
    carregando,
    erro,
    carregar,
    limpar,
    pode: modulo => Boolean(acesso?.ativo && acesso.permissoes?.includes(modulo))
  }), [acesso, carregando, erro, carregar, limpar])

  return <AcessoContext.Provider value={valor}>{children}</AcessoContext.Provider>
}

export function useAcesso() {
  const contexto = useContext(AcessoContext)
  if (!contexto) throw new Error('useAcesso precisa estar dentro de AcessoProvider.')
  return contexto
}
