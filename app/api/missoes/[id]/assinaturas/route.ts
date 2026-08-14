import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ETAPAS = ['entrega', 'retirada'] as const
const TAMANHO_MAXIMO = 1024 * 1024

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let caminhoEnviado = ''

  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Operação'])
    const { id: missaoId } = await params
    const formulario = await request.formData()
    const arquivo = formulario.get('assinatura')
    const etapa = String(formulario.get('etapa') || '')
    const nomeAssinante = String(formulario.get('nome_assinante') || '').trim().slice(0, 120)

    if (!(arquivo instanceof File) || arquivo.type !== 'image/png') {
      throw new Error('A assinatura precisa ser enviada no formato PNG.')
    }
    if (arquivo.size <= 0 || arquivo.size > TAMANHO_MAXIMO) {
      throw new Error('A assinatura deve ter no máximo 1 MB.')
    }
    if (!ETAPAS.includes(etapa as (typeof ETAPAS)[number])) {
      throw new Error('Selecione entrega ou retirada.')
    }
    if (nomeAssinante.length < 2) {
      throw new Error('Informe o nome de quem está assinando.')
    }

    const { data: missao, error: missaoError } = await supabaseServer
      .from('ordens_servico')
      .select('id,reserva_id')
      .eq('id', missaoId)
      .maybeSingle()

    if (missaoError) throw missaoError
    if (!missao?.reserva_id) throw new Error('Missão não encontrada ou sem reserva vinculada.')

    const { data: existente, error: existenteError } = await supabaseServer
      .from('assinaturas_missao')
      .select('id')
      .eq('ordem_servico_id', missaoId)
      .eq('etapa', etapa)
      .maybeSingle()

    if (existenteError) throw existenteError
    if (existente) {
      throw new Error(`A assinatura da ${etapa} já foi registrada e preservada na missão.`)
    }

    const assinaturaId = randomUUID()
    caminhoEnviado = `${vinculo.empresa_id}/${missao.reserva_id}/${missaoId}/${assinaturaId}.png`

    const { error: uploadError } = await supabaseServer.storage
      .from('assinaturas-missao')
      .upload(caminhoEnviado, await arquivo.arrayBuffer(), {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    const { data: assinatura, error: assinaturaError } = await supabaseServer
      .from('assinaturas_missao')
      .insert({
        id: assinaturaId,
        empresa_id: vinculo.empresa_id,
        reserva_id: missao.reserva_id,
        ordem_servico_id: missaoId,
        etapa,
        nome_assinante: nomeAssinante,
        storage_path: caminhoEnviado,
        mime_type: 'image/png',
        registrada_por: usuario.id,
        metadados: { origem: 'MissionWorkspace' }
      })
      .select('id,etapa,nome_assinante,assinada_em')
      .single()

    if (assinaturaError) {
      await supabaseServer.storage.from('assinaturas-missao').remove([caminhoEnviado])
      caminhoEnviado = ''
      throw assinaturaError
    }

    const caminhoAssinatura = caminhoEnviado
    caminhoEnviado = ''

    const { data: url } = await supabaseServer.storage
      .from('assinaturas-missao')
      .createSignedUrl(caminhoAssinatura, 60 * 60)

    return NextResponse.json({
      sucesso: true,
      assinatura: {
        ...assinatura,
        url: url?.signedUrl || '',
        registrada_por_nome: vinculo.nome || 'Equipe operacional'
      }
    }, { status: 201 })
  } catch (error: unknown) {
    if (caminhoEnviado) {
      await supabaseServer.storage.from('assinaturas-missao').remove([caminhoEnviado])
    }

    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}
