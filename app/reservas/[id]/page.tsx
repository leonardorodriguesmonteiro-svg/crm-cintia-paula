import { ReservaDetalhePage } from '@/components/ReservaDetalhePage'
import { PageLayout } from '@/components/PageLayout'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PageLayout><ReservaDetalhePage id={id} /></PageLayout>
}
