import { NextRequest, NextResponse } from 'next/server'
import { statusConfiguracaoMercadoPago } from '@/lib/mercadoPago'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ...statusConfiguracaoMercadoPago(),
    webhook_url: `${request.nextUrl.origin}/api/webhooks/mercado-pago`
  }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

