import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const DOMINIOS_PUBLICOS = new Set([
  'cintiapaulafestaedecoracao.com.br',
  'www.cintiapaulafestaedecoracao.com.br'
])

const ROTAS_PUBLICAS_SITE = new Map<string, string>([
  ['/', '/site'],
  ['/kits', '/site/kits'],
  ['/como-funciona', '/site/como-funciona'],
  ['/sobre', '/site/sobre'],
  ['/duvidas', '/site/duvidas'],
  ['/contato', '/site/contato']
])

const ROTAS_INTERNAS_SITE = new Map<string, string>(
  Array.from(ROTAS_PUBLICAS_SITE.entries()).map(([publica, interna]) => [interna, publica])
)

function hostnameDaRequisicao(request: NextRequest) {
  return (request.headers.get('host') || request.nextUrl.hostname)
    .split(':')[0]
    .trim()
    .toLowerCase()
}

function rotaPublicaPermitida(pathname: string) {
  if (pathname === '/reservar') return true
  if (pathname.startsWith('/proposta/')) return true
  if (pathname.startsWith('/contrato/')) return true

  if (pathname === '/api/catalogo') return true
  if (pathname === '/api/publico/pre-reservas') return true
  if (pathname === '/api/webhooks/mercado-pago') return true

  if (/^\/api\/propostas\/[^/]+(?:\/dados-cliente)?$/.test(pathname)) return true
  if (/^\/api\/contratos\/[^/]+(?:\/pagamento)?$/.test(pathname)) return true

  return false
}

export function proxy(request: NextRequest) {
  const hostname = hostnameDaRequisicao(request)
  if (!DOMINIOS_PUBLICOS.has(hostname)) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  const rotaPublica = ROTAS_INTERNAS_SITE.get(pathname)
  if (rotaPublica !== undefined) {
    const destino = request.nextUrl.clone()
    destino.pathname = rotaPublica || '/'
    destino.search = ''
    return NextResponse.redirect(destino)
  }

  const rotaInterna = ROTAS_PUBLICAS_SITE.get(pathname)
  if (rotaInterna) {
    const destino = request.nextUrl.clone()
    destino.pathname = rotaInterna
    return NextResponse.rewrite(destino)
  }

  if (rotaPublicaPermitida(pathname)) {
    return NextResponse.next()
  }

  const destino = request.nextUrl.clone()
  destino.pathname = '/'
  destino.search = ''
  return NextResponse.redirect(destino)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
