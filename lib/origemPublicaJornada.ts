export const ORIGEM_PUBLICA_PRODUCAO = 'https://www.cintiapaulafestaedecoracao.com.br'

export function origemPublicaJornada(origem: string) {
  const url = new URL(origem)
  const oficiais = ['cintiapaulafestaedecoracao.com.br', 'www.cintiapaulafestaedecoracao.com.br', 'erp.cintiapaulafestaedecoracao.com.br']
  if (url.protocol === 'https:' && oficiais.includes(url.hostname) && !url.port) return ORIGEM_PUBLICA_PRODUCAO
  const homologacao = url.hostname === 'crm-cintia-paula-homologacao.vercel.app'
  const deployment = /^crm-cintia-paula-(?:homologacao|v3-supabase)(?:-[a-z0-9-]+)?-crm-festas[.]vercel[.]app$/.test(url.hostname)
  if (url.protocol === 'https:' && !url.port && (homologacao || deployment)) return url.origin
  if (['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) return url.origin
  throw new Error('Origem pública não reconhecida para esta jornada.')
}
