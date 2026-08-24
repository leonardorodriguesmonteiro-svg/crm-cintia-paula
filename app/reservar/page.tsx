import type { Metadata } from 'next'
import { ReservaPublicaDireta } from '@/components/publico/ReservaPublicaDireta'

export const metadata: Metadata = {
  title: 'Reserve sua festa | Cintia Paula Festas & Decorações',
  description: 'Escolha um KIT pronto ou monte seu próprio KIT para solicitar sua reserva.'
}

export default function Page() {
  return (
    <>
      <style>{`button[aria-label="Abrir Central de Feedback"]{display:none!important}`}</style>
      <ReservaPublicaDireta />
    </>
  )
}
