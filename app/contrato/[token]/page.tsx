import type { Metadata } from 'next'
import { ContratoPublicoPage } from '@/components/comercial/ContratoPublicoPage'

export const metadata: Metadata = {
  title: 'Contrato digital | Cintia Paula',
  description: 'Consulte, assine seu contrato e acesse as instruções do sinal.',
  robots: { index: false, follow: false }
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ContratoPublicoPage token={token} />
}

