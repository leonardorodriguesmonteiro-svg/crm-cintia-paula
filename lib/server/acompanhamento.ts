import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { supabaseServer } from '@/lib/supabaseServer'

export const ORIGEM_OFICIAL = 'https://www.cintiapaulafestaedecoracao.com.br'
export const tokenValido = (token: unknown): token is string => typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
function chave() {
  const segredo = process.env.ACOMPANHAMENTO_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!segredo) throw new Error('Proteção dos links não configurada.')
  return createHash('sha256').update(`acompanhamento:v1:${segredo}`).digest()
}
export function cifrarToken(token: string, pedido: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', chave(), iv)
  cipher.setAAD(Buffer.from(pedido))
  const corpo = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), corpo].map(b => b.toString('base64url')).join('.')
}
export function decifrarToken(valor: string, pedido: string) {
  const [iv, tag, corpo] = valor.split('.').map(v => Buffer.from(v, 'base64url'))
  const cipher = createDecipheriv('aes-256-gcm', chave(), iv)
  cipher.setAAD(Buffer.from(pedido))
  cipher.setAuthTag(tag)
  const token = Buffer.concat([cipher.update(corpo), cipher.final()]).toString('utf8')
  if (!tokenValido(token)) throw new Error('Link inválido.')
  return token
}
export async function gerarLink(oportunidadeId: string, empresaId: string, substituir = false) {
  const { data: pedido, error } = await supabaseServer.from('oportunidades').select('id')
    .eq('id', oportunidadeId).eq('empresa_id', empresaId).maybeSingle()
  if (error || !pedido) throw new Error('Pedido não encontrado.')
  const { data: atual, error: leitura } = await supabaseServer.from('acompanhamento_links')
    .select('token_hash,token_cifrado,expires_at,revoked_at').eq('oportunidade_id', oportunidadeId).maybeSingle()
  if (leitura) throw new Error('Não foi possível consultar o link.')
  if (atual && !substituir && !atual.revoked_at && Date.parse(atual.expires_at) > Date.now()) {
    if (!atual.token_cifrado) throw new Error('Este link antigo não pode ser recuperado. Use Substituir link para emitir um novo.')
    let token: string
    try { token = decifrarToken(atual.token_cifrado, oportunidadeId) }
    catch { throw new Error('Não foi possível recuperar este link. Use Substituir link para emitir um novo.') }
    if (hashToken(token) !== atual.token_hash) throw new Error('Link inconsistente.')
    return `${ORIGEM_OFICIAL}/acompanhar#${token}`
  }
  if (atual && !substituir) throw new Error('Link revogado ou expirado. Use Substituir link para emitir um novo.')
  const token = randomBytes(32).toString('base64url')
  const registro = { oportunidade_id: oportunidadeId, token_hash: hashToken(token),
    token_cifrado: cifrarToken(token, oportunidadeId),
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(), revoked_at: null }
  const resultado = substituir
    ? await supabaseServer.from('acompanhamento_links').upsert(registro, { onConflict: 'oportunidade_id' })
    : await supabaseServer.from('acompanhamento_links').insert(registro)
  if (resultado.error) {
    if (!substituir && resultado.error.code === '23505') return gerarLink(oportunidadeId, empresaId)
    throw new Error('Não foi possível gerar o acompanhamento.')
  }
  return `${ORIGEM_OFICIAL}/acompanhar#${token}`
}
