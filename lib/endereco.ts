type ParteEndereco = string | null | undefined

export function limparParteEndereco(valor: ParteEndereco) {
  return String(valor || '')
    .trim()
    .replace(/^[\s,;]+|[\s,;]+$/g, '')
    .replace(/\s{2,}/g, ' ')
}

export function formatarCepEndereco(valor: ParteEndereco) {
  const digitos = String(valor || '').replace(/\D/g, '').slice(0, 8)
  if (!digitos) return ''
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}

export function formatarEnderecoCompleto(
  partes: ParteEndereco[],
  cep?: ParteEndereco
) {
  const endereco = partes
    .map(limparParteEndereco)
    .filter(Boolean)
    .join(', ')
  const cepFormatado = formatarCepEndereco(cep)

  return [endereco, cepFormatado ? `CEP ${cepFormatado}` : '']
    .filter(Boolean)
    .join(' — ')
}
