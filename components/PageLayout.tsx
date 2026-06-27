import { AuthGate } from './AuthGate'
import { Shell } from './Shell'

export function PageLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate><Shell>{children}</Shell></AuthGate>
}
