import { supabase } from '@/lib/supabase'

export const BUCKET_FOTOS_CATALOGO = 'catalogo-fotos'
export const TIPOS_IMAGEM_CATALOGO = ['image/jpeg', 'image/png', 'image/webp']
export const LIMITE_ORIGINAL_FOTO = 15 * 1024 * 1024

function extensaoDoTipo(tipo: string) {
  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/webp') return 'webp'
  return 'jpg'
}

export async function prepararFotoCatalogo(arquivo: File) {
  if (!TIPOS_IMAGEM_CATALOGO.includes(arquivo.type)) {
    throw new Error('Use uma imagem JPG, PNG ou WebP.')
  }

  if (arquivo.size > LIMITE_ORIGINAL_FOTO) {
    throw new Error('A imagem original deve ter no máximo 15 MB.')
  }

  const urlTemporaria = URL.createObjectURL(arquivo)
  const imagem = await new Promise<HTMLImageElement>((resolve, reject) => {
    const elemento = new Image()
    elemento.onload = () => resolve(elemento)
    elemento.onerror = () => reject(new Error('Não foi possível abrir a imagem selecionada.'))
    elemento.src = urlTemporaria
  }).finally(() => URL.revokeObjectURL(urlTemporaria))

  const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight)
  const escala = Math.min(1920 / maiorLado, 1)
  const largura = Math.max(Math.round(imagem.naturalWidth * escala), 1)
  const altura = Math.max(Math.round(imagem.naturalHeight * escala), 1)
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura

  const contexto = canvas.getContext('2d')
  if (!contexto) {
    throw new Error('Não foi possível preparar a imagem.')
  }

  contexto.drawImage(imagem, 0, 0, largura, altura)

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/webp', 0.86)
  )

  if (!blob) throw new Error('Não foi possível otimizar a imagem.')

  return new File(
    [blob],
    `${arquivo.name.replace(/\.[^.]+$/, '') || 'foto'}.webp`,
    { type: 'image/webp' }
  )
}

export async function enviarFotoCatalogo(
  arquivoOriginal: File,
  entidade: 'kits' | 'estoque',
  registroId: string
) {
  const arquivo = await prepararFotoCatalogo(arquivoOriginal)
  const caminho = `${entidade}/${registroId}/${crypto.randomUUID()}.${extensaoDoTipo(arquivo.type)}`
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS_CATALOGO)
    .upload(caminho, arquivo, {
      cacheControl: '31536000',
      contentType: arquivo.type,
      upsert: false
    })

  if (error) throw error

  const { data } = supabase.storage
    .from(BUCKET_FOTOS_CATALOGO)
    .getPublicUrl(caminho)

  return { caminho, url: data.publicUrl }
}

export function caminhoFotoCatalogo(url: string | null | undefined) {
  if (!url) return null
  const marcador = `/storage/v1/object/public/${BUCKET_FOTOS_CATALOGO}/`
  const indice = url.indexOf(marcador)
  if (indice === -1) return null

  try {
    return decodeURIComponent(url.slice(indice + marcador.length))
  } catch {
    return url.slice(indice + marcador.length)
  }
}

export async function excluirFotoCatalogo(url: string | null | undefined) {
  const caminho = caminhoFotoCatalogo(url)
  if (!caminho) return
  const { error } = await supabase.storage
    .from(BUCKET_FOTOS_CATALOGO)
    .remove([caminho])

  if (error) throw error
}
