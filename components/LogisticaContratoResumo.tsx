import type { LogisticaContrato } from '@/lib/logisticaContrato'
const data = (v: string) => v ? new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informado'
export function LogisticaContratoResumo({ logistica }: { logistica?: Partial<LogisticaContrato> | null }) {
  if (!logistica?.modalidade) return null
  return <div className="space-y-2" style={{ breakInside: 'avoid' }}>
    <p><strong>Tipo de local:</strong> {logistica.tipo_local_evento || 'Não informado'}</p>
    <p><strong>Modalidade:</strong> {logistica.modalidade}</p>
    {logistica.modalidade === 'Retirada' && <>
      <p><strong>Retirada:</strong> {data(logistica.data_retirada || '')} às {logistica.horario_retirada || 'Não informado'}<br /><strong>Endereço da retirada:</strong> {logistica.endereco_retirada}</p>
      <p><strong>Devolução:</strong> {data(logistica.data_devolucao || '')} às {logistica.horario_devolucao || 'Não informado'}<br /><strong>Endereço da devolução:</strong> {logistica.endereco_devolucao}</p>
      <p>Atendimento: segunda a sexta-feira, 09:00 às 12:00 e 14:00 às 18:00 (Brasília), exceto feriados e pontos facultativos. Devolução no primeiro dia de atendimento após o evento, no horário agendado.</p>
    </>}
  </div>
}
