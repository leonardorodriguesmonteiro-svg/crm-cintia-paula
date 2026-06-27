import './globals.css'

export const metadata = { title: 'CRM Cintia Paula', description: 'Sistema de gestão para festas e decorações' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
