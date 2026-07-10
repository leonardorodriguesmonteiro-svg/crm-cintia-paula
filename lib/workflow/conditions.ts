export function avaliarCondicao(condicao: string | null) {
  if (!condicao || condicao === 'SEMPRE') return true

  return false
}
