import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ETAPAS = ['preparacao', 'entrega', 'evento', 'retirada', 'devolucao'] as const
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']
const TAMANHO_MAXIMO = 8 * 1024 * 1024

function extensaoImagem(tipo: string) {
  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/jpeg') return 'jpg'
  return 'webp'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let caminhoEnviado = ''

  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Operação', 'Estoque'])
    const { id: missaoId } = await params
    const formulario = await request.formData()
    const arquivo = formulario.get('arquivo')
    const etapa = String(formulario.get('etapa') || '')
    const descricao = String(formulario.get('descricao') || '').trim().slice(0, 500)
    const capturadaEmInformada = String(formulario.get('capturada_em') || '')

    if (!(arquivo instanceof File)) {
      throw new Error('Selecione uma foto para enviar.')
    }
    if (!TIPOS_IMAGEM.includes(arquivo.type)) {
      throw new Error('Use uma foto JPG, PNG ou WebP.')
    }
    if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO) {
      throw new Error('A foto otimizada deve ter no máximo 8 MB.')
    }
    if (!ETAPAS.includes(etapa as (typeof ETAPAS)[number])) {
      throw new Error('Selecione uma etapa válida da missão.')
    }

    const { data: missao, error: missaoError } = await supabaseServer
      .from('ordens_servico')
      .select('id,reserva_id')
      .eq('id', missaoId)
      .maybeSingle()

    if (missaoError) throw missaoError
    if (!missao?.reserva_id) throw new Error('Missão não encontrada ou sem reserva vinculada.')

    const evidenciaId = randomUUID()
    caminhoEnviado = `${vinculo.empresa_id}/${missao.reserva_id}/${missaoId}/${evidenciaId}.${extensaoImagem(arquivo.type)}`

    const { error: uploadError } = await supabaseServer.storage
      .from('evidencias-missao')
      .upload(caminhoEnviado, await arquivo.arrayBuffer(), {
        contentType: arquivo.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    const capturadaEm = Number.isNaN(Date.parse(capturadaEmInformada))
      ? new Date().toISOString()
      : new Date(capturadaEmInformada).toISOString()

    const { data: evidencia, error: evidenciaError } = await supabaseServer
      .from('evidencias_missao')
      .insert({
        id: evidenciaId,
        empresa_id: vinculo.empresa_id,
        reserva_id: missao.reserva_id,
        ordem_servico_id: missaoId,
        tipo: 'foto',
        etapa,
        titulo: arquivo.name.slice(0, 160) || null,
        descricao: descricao || null,
        storage_path: caminhoEnviado,
        mime_type: arquivo.type,
        tamanho_bytes: arquivo.size,
        capturada_em: capturadaEm,
        criada_por: usuario.id,
        metadados: { origem: 'MissionWorkspace' }
      })
      .select('id,tipo,etapa,titulo,descricao,mime_type,tamanho_bytes,capturada_em')
      .single()

    if (evidenciaError) {
      await supabaseServer.storage.from('evidencias-missao').remove([caminhoEnviado])
      caminhoEnviado = ''
      throw evidenciaError
    }

    const caminhoEvidencia = caminhoEnviado
    caminhoEnviado = ''

    const { data: url } = await supabaseServer.storage
      .from('evidencias-missao')
      .createSignedUrl(caminhoEvidencia, 60 * 60)

    return NextResponse.json({
      sucesso: true,
      evidencia: {
        ...evidencia,
        url: url?.signedUrl || '',
        autor: vinculo.nome || 'Equipe operacional'
      }
    }, { status: 201 })
  } catch (error: unknown) {
    if (caminhoEnviado) {
      await supabaseServer.storage.from('evidencias-missao').remove([caminhoEnviado])
    }

    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}
