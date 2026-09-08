export function normalizarBusca(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
}

export function correspondeBusca(busca: string, campos: Array<string | null | undefined>) {
  const texto = normalizarBusca(campos.filter(Boolean).join(' '))
  return normalizarBusca(busca).split(/\s+/).every(termo => texto.includes(termo))
}
