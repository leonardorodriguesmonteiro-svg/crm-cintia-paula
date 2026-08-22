import type { Metadata } from 'next'
import { ReservaPublicaPage } from '@/components/publico/ReservaPublicaPage'

export const metadata: Metadata = {
  title: 'Monte sua festa | Cintia Paula Festas & Decorações',
  description: 'Escolha um KIT pronto ou monte seu próprio KIT para solicitar sua reserva.'
}

export default function Page() {
  return (
    <>
      <style>{`button[aria-label="Abrir Central de Feedback"]{display:none!important}`}</style>
      <ReservaPublicaPage />
    </>
  )
}
