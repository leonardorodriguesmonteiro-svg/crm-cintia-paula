import { createHash, randomBytes } from 'node:crypto'
import { supabaseServer } from '@/lib/supabaseServer'

export const ORIGEM_OFICIAL = 'https://www.cintiapaulafestaedecoracao.com.br'
export const tokenValido = (token: unknown): token is string => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function gerarLink(oportunidadeId: string, empresaId: string, substituir = false) {
  const { data: pedido, error } = await supabaseServer.from('oportunidades').select('id')
    .eq('id', oportunidadeId).eq('empresa_id', empresaId).maybeSingle()
  if (error || !pedido) throw new Error('Pedido não encontrado.')
  const token = randomBytes(32).toString('base64url')
  const registro = {
    oportunidade_id: oportunidadeId,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    revoked_at: null
  }
  const resultado = substituir
    ? await supabaseServer.from('acompanhamento_links').upsert(registro, { onConflict: 'oportunidade_id' })
    : await supabaseServer.from('acompanhamento_links').insert(registro)
  if (resultado.error) throw new Error('Não foi possível gerar o acompanhamento.')
  // Fragment keeps the bearer token out of HTTP request URLs and referrers.
  return `${ORIGEM_OFICIAL}/acompanhar#${token}`
}
