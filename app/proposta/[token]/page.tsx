import type { Metadata } from 'next'
import { PropostaPublicaPage } from '@/components/comercial/PropostaPublicaPage'

export const metadata: Metadata = {
  title: 'Proposta comercial | Cintia Paula',
  description: 'Consulte e responda sua proposta comercial.',
  robots: { index: false, follow: false }
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PropostaPublicaPage token={token} />
}
