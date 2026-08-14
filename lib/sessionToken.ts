import { supabase } from '@/lib/supabase'

export async function obterTokenSessao() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Sua sessão expirou. Entre novamente no ERP.')
  }

  return token
}
