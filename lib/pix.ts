function campo(id: string, valor: string) {
  return `${id}${String(valor.length).padStart(2, '0')}${valor}`
}

function normalizar(valor: string, limite: number) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, limite)
}

function crc16(payload: string) {
  let crc = 0xffff

  for (let indice = 0; indice < payload.length; indice += 1) {
    crc ^= payload.charCodeAt(indice) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

type DadosPix = {
  chave: string
  beneficiario?: string | null
  cidade?: string | null
  valor: number
  identificador?: string | null
}

export function gerarPixCopiaECola({
  chave,
  beneficiario,
  cidade,
  valor,
  identificador
}: DadosPix) {
  const chaveLimpa = chave.trim().slice(0, 77)
  if (!chaveLimpa || !Number.isFinite(valor) || valor <= 0) return null

  const conta = campo('00', 'BR.GOV.BCB.PIX') + campo('01', chaveLimpa)
  const nome = normalizar(beneficiario || 'Cintia Paula', 25) || 'CINTIA PAULA'
  const cidadeNormalizada = normalizar(cidade || 'Rio de Janeiro', 15) || 'RIO DE JANEIRO'
  const txid = normalizar(identificador || '***', 25).replace(/\s/g, '') || '***'

  const payloadSemCrc = [
    campo('00', '01'),
    campo('26', conta),
    campo('52', '0000'),
    campo('53', '986'),
    campo('54', valor.toFixed(2)),
    campo('58', 'BR'),
    campo('59', nome),
    campo('60', cidadeNormalizada),
    campo('62', campo('05', txid)),
    '6304'
  ].join('')

  return `${payloadSemCrc}${crc16(payloadSemCrc)}`
}

