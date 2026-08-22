import { PageLayout } from '@/components/PageLayout'
import { FormalizacaoComercialV2Panel } from '@/components/comercial/FormalizacaoComercialV2Panel'
import { OrcamentosPage } from '@/components/comercial/OrcamentosPage'

export default function Page() {
  return (
    <PageLayout>
      <div className="space-y-6">
        <FormalizacaoComercialV2Panel />
        <OrcamentosPage />
      </div>
    </PageLayout>
  )
}
