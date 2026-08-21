import { createHmac } from 'crypto'
import type { NextRequest } from 'next/server'

const ORIGENS_PADRAO = [
  'https://cintiapaulafestaedecoracao.com.br',
  'https://www.cintiapaulafestaedecoracao.com.br'
]

export const LIMITE_PRE_RESERVAS = 10
export const JANELA_PRE_RESERVAS_SEGUNDOS = 15 * 60
export const TAMANHO_MAXIMO_PRE_RESERVA = 64 * 1024

export function empresaDoSite() {
  const empresaId = String(process.env.SITE_EMPRESA_ID || '').trim()
  if (!empresaId) {
    throw new Error('SITE_EMPRESA_ID não configurado no servidor.')
  }
  return empresaId
}

export function origensPermitidas() {
  const configuradas = String(process.env.SITE_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origem => origem.trim())
    .filter(Boolean)

  const origens = configuradas.length ? configuradas : ORIGENS_PADRAO
  if (process.env.NODE_ENV !== 'production') {
    origens.push('http://localhost:3000', 'http://localhost:3001')
  }

  return new Set(origens.map(origem => new URL(origem).origin))
}

export function origemDaRequisicao(request: NextRequest) {
  const origem = request.headers.get('origin')
  if (!origem) return null

  try {
    return new URL(origem).origin
  } catch {
    return null
  }
}

export function cabecalhosCors(origem: string) {
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, max-age=0',
    Vary: 'Origin'
  }
}

export function hashDoSolicitante(request: NextRequest, empresaId: string) {
  const ip = (
    request.headers.get('x-forwarded-for')?.split(',')[0]
    || request.headers.get('x-real-ip')
    || 'nao-informado'
  ).trim()
  const segredo = String(
    process.env.PRE_RESERVA_RATE_LIMIT_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || ''
  )

  if (!segredo) {
    throw new Error('Segredo do rate limit não configurado no servidor.')
  }

  return createHmac('sha256', segredo)
    .update(`${empresaId}:${ip}`)
    .digest('hex')
}
