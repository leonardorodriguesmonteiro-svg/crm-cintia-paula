import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Cintia Paula Festas & Decorações',
  description: 'Kits, Pegue e Monte, orçamento e reserva para sua festa.'
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`button[aria-label="Abrir Central de Feedback"]{display:none!important}`}</style>
      {children}
    </>
  )
}
