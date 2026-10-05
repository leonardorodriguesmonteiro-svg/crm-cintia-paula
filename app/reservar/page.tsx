import type { Metadata } from 'next'
import { ReservaPublicaDireta } from '@/components/publico/ReservaPublicaDireta'

export const metadata: Metadata = {
  title: 'Solicite seu orçamento | Cintia Paula Festas & Decorações',
  description: 'Escolha os itens da sua festa, solicite seu orçamento e acompanhe tudo pelo site.'
}

export default function Page() {
  return (
    <>
      <style>{`button[aria-label="Abrir Central de Feedback"]{display:none!important}`}</style>
      <ReservaPublicaDireta />
    </>
  )
}
