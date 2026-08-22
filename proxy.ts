import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const DOMINIOS_PUBLICOS = new Set([
  'cintiapaulafestaedecoracao.com.br',
  'www.cintiapaulafestaedecoracao.com.br'
])

function hostnameDaRequisicao(request: NextRequest) {
  return (request.headers.get('host') || request.nextUrl.hostname)
    .split(':')[0]
    .trim()
    .toLowerCase()
}

function rotaPublicaPermitida(pathname: string) {
  if (pathname === '/' || pathname === '/reservar') return true
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

  if (pathname === '/') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/reservar'
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
