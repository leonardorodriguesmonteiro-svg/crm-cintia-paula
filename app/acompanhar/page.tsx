import { SitePublicoLayout } from '@/components/publico/SitePublicoLayout'
import { AcompanhamentoCliente } from '@/components/publico/AcompanhamentoCliente'
export const metadata = {
  title: 'Acompanhar pedido | Cintia Paula',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const
}
export const dynamic = 'force-dynamic'
export default function Page() { return <SitePublicoLayout><AcompanhamentoCliente /></SitePublicoLayout> }
