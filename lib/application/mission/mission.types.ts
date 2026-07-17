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
}
