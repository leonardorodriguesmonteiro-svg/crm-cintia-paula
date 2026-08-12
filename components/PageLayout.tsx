import { AuthGate } from './AuthGate'
import { Shell } from './Shell'
import { AcessoProvider } from './auth/AcessoContext'

export function PageLayout({ children }: { children: React.ReactNode }) {
  return <AcessoProvider><AuthGate><Shell>{children}</Shell></AuthGate></AcessoProvider>
}
