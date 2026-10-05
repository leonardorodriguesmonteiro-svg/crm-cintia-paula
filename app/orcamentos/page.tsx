import { PageLayout } from '@/components/PageLayout'
import { OrcamentosPage } from '@/components/comercial/OrcamentosPage'
import { PreReservasPanel } from '@/components/comercial/PreReservasPanel'

export default function Page() {
  return (
    <PageLayout>
      <div className="space-y-6">
        <PreReservasPanel />
        <OrcamentosPage />
      </div>
    </PageLayout>
  )
}
