export type MissionViewModel = {
  id: string
  reservaId: string
  numero: string
  status: string
  etapaAtual: string
  progresso: number

  evento: {
    data: string | null
    horario: string | null
    endereco: string | null
    cliente: string
    kit: string
  }

  equipe: {
    id: string
    nome: string
    funcao: string
    inicio: string | null
    fim: string | null
  }[]

  checklist: {
    id: string
    etapa: string
    descricao: string
    concluido: boolean
    obrigatoria: boolean
  }[]

  proximaAcao: {
    tarefaId: string | null
    titulo: string
    etapa: string
  }

  timeline: {
    id: string
    titulo: string
    descricao: string | null
    modulo: string
    data: string
  }[]

  evidencias: {
    id: string
    tipo: 'foto'
    etapa: 'preparacao' | 'entrega' | 'evento' | 'retirada' | 'devolucao'
    titulo: string | null
    descricao: string | null
    url: string
    mimeType: string
    tamanhoBytes: number
    capturadaEm: string
    autor: string
  }[]

  assinaturas: {
    id: string
    etapa: 'entrega' | 'retirada'
    nomeAssinante: string
    assinadaEm: string
    url: string
    registradaPor: string
  }[]

  responsaveisDisponiveis: {
    id: string
    nome: string
    perfil: 'Administrador' | 'Operação' | 'Estoque'
  }[]

  ocorrencias: {
    id: string
    tipo: 'dano' | 'item_faltante' | 'atraso' | 'outro'
    etapa: 'preparacao' | 'entrega' | 'evento' | 'retirada' | 'devolucao'
    prioridade: 'baixa' | 'media' | 'alta' | 'critica'
    status: 'aberta' | 'em_acompanhamento' | 'resolvida'
    titulo: string
    descricao: string
    responsavelId: string | null
    responsavelNome: string
    resolucao: string | null
    resolvidaEm: string | null
    resolvidaPor: string | null
    criadaEm: string
    criadaPor: string
    atualizadaEm: string
    fotos: {
      id: string
      url: string
      mimeType: string
      tamanhoBytes: number
    }[]
  }[]
}
