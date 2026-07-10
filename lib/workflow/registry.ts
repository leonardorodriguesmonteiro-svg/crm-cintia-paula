import {
  criarContratoSeNaoExistir,
  criarOSSeNaoExistir,
  registrarTimeline
} from './actions'

type ActionParams = {
  reservaId: string
  evento: string
  nomeRegra: string
}

export async function executarAcao(
  codigoAcao: string,
  params: ActionParams
) {
  switch (codigoAcao) {
    case 'CRIAR_CONTRATO':
      await criarContratoSeNaoExistir(params.reservaId)
      return

    case 'CRIAR_OS':
      await criarOSSeNaoExistir(params.reservaId)
      return

    case 'REGISTRAR_TIMELINE':
      await registrarTimeline(
        params.reservaId,
        'Workflow executado',
        `${params.nomeRegra} — evento ${params.evento}.`
      )
      return

    default:
      throw new Error(`Ação não registrada no Workflow: ${codigoAcao}`)
  }
}
