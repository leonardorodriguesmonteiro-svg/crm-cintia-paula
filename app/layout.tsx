import './globals.css'
import { FeedbackButton } from '@/components/feedback/FeedbackButton'

export const metadata = { title: 'CRM Cintia Paula', description: 'Sistema de gestão para festas e decorações' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}        <FeedbackButton />
      </body></html>
}