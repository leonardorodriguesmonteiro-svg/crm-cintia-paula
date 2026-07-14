type Contrato = {
  status: string | null
}

type OrdemServico = {
  status: string | null
}

type WorkflowAcao = {
  status: string | null
}

type Params = {
  contratos: Contrato[]
  ordens: OrdemServico[]
  workflowAcoes: WorkflowAcao[]
  recomendacoesAltas: number
  recomendacoesMedias: number
}

function limitar(valor: number) {
  return Math.max(0, Math.min(100, Math.round(valor)))
}

export function calcularOperationalScore({
  contratos,
  ordens,
  workflowAcoes,
  recomendacoesAltas,
  recomendacoesMedias
}: Params) {
  const contratosValidos = contratos.filter(
    item => item.status !== 'Cancelado'
  )

  const contratosAssinados = contratosValidos.filter(
    item => item.status === 'Assinado'
  ).length

  const juridico = contratosValidos.length
    ? limitar((contratosAssinados / contratosValidos.length) * 100)
    : 100

  const ordensConcluidas = ordens.filter(
    item => item.status === 'Concluída'
  ).length

  const operacao = ordens.length
    ? limitar((ordensConcluidas / ordens.length) * 100)
    : 100

  const acoesExecutadas = workflowAcoes.filter(
    item => item.status === 'Executada'
  ).length

  const workflow = workflowAcoes.length
    ? limitar((acoesExecutadas / workflowAcoes.length) * 100)
    : 100

  const penalidadeFinanceira =
    recomendacoesAltas * 15 +
    recomendacoesMedias * 7

  const financeiro = limitar(100 - penalidadeFinanceira)

  const geral = limitar(
    (financeiro + juridico + operacao + workflow) / 4
  )

  return {
    geral,
    financeiro,
    juridico,
    operacao,
    workflow
  }
}
