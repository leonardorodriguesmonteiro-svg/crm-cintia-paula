import { MissionWorkspace } from '@/components/business/mission/MissionWorkspace'
import { PageLayout } from '@/components/PageLayout'

export default async function Page({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <PageLayout><MissionWorkspace missaoId={id} /></PageLayout>
}
