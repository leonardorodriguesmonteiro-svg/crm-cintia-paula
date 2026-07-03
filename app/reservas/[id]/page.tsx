import { ReservaDetalhePage } from '@/components/ReservaDetalhePage'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ReservaDetalhePage id={id} />
}
