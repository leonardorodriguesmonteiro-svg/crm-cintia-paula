import { ERPEvents } from '@/lib/events/catalog'
import { publicarEvento } from '@/lib/events/eventBus'

type ResultadoConfirmacao = {
  nova_confirmacao?: boolean
  reserva_id?: string | null
}

export async function publicarConfirmacaoReservaV2(
  resultado: ResultadoConfirmacao,
  origem: string
) {
  if (!resultado.nova_confirmacao || !resultado.reserva_id) {
    return { publicado: false, avisos: [] as string[] }
  }

  const processamento = await publicarEvento({
    codigo: ERPEvents.RESERVA_CONFIRMADA,
    titulo: 'Reserva confirmada',
    descricao: 'Contrato assinado e sinal pago. A reserva comercial foi confirmada.',
    reservaId: resultado.reserva_id,
    entidadeTipo: 'Reserva',
    entidadeId: resultado.reserva_id,
    modulo: 'Comercial',
    origem,
    status: 'Confirmada',
    metadados: {
      jornada: 'COMERCIAL_V2',
      contrato_assinado: true,
      sinal_pago: true
    }
  })

  return {
    publicado: processamento.sucesso,
    avisos: processamento.sucesso
      ? []
      : processamento.erros.map(erro => `Workflow pendente: ${erro}`)
  }
}
