import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TIPOS = ['dano', 'item_faltante', 'atraso', 'outro'] as const
const ETAPAS = ['preparacao', 'entrega', 'evento', 'retirada', 'devolucao'] as const
const PRIORIDADES = ['baixa', 'media', 'alta', 'critica'] as const
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp']
const TAMANHO_MAXIMO = 8 * 1024 * 1024
const LIMITE_FOTOS = 6

function extensaoImagem(tipo: string) {
  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/jpeg') return 'jpg'
  return 'webp'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caminhosEnviados: string[] = []
  let ocorrenciaId = ''

  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Operação', 'Estoque'])
    const { id: missaoId } = await params
    const formulario = await request.formData()
    const tipo = String(formulario.get('tipo') || '')
    const etapa = String(formulario.get('etapa') || '')
    const prioridade = String(formulario.get('prioridade') || '')
    const titulo = String(formulario.get('titulo') || '').trim().slice(0, 160)
    const descricao = String(formulario.get('descricao') || '').trim().slice(0, 2000)
    const responsavelUsuarioId = String(formulario.get('responsavel_usuario_id') || '')
    const fotos = formulario.getAll('fotos').filter(item => item instanceof File) as File[]

    if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) throw new Error('Selecione um tipo válido de ocorrência.')
    if (!ETAPAS.includes(etapa as (typeof ETAPAS)[number])) throw new Error('Selecione uma etapa válida da missão.')
    if (!PRIORIDADES.includes(prioridade as (typeof PRIORIDADES)[number])) throw new Error('Selecione uma prioridade válida.')
    if (titulo.length < 3) throw new Error('Informe um título para a ocorrência.')
    if (descricao.length < 5) throw new Error('Descreva o que aconteceu.')
    if (!responsavelUsuarioId) throw new Error('Selecione o responsável pelo acompanhamento.')
    if (fotos.length > LIMITE_FOTOS) throw new Error(`Envie no máximo ${LIMITE_FOTOS} fotos.`)

    for (const foto of fotos) {
      if (!TIPOS_IMAGEM.includes(foto.type)) throw new Error('Use fotos JPG, PNG ou WebP.')
      if (foto.size <= 0 || foto.size > TAMANHO_MAXIMO) throw new Error('Cada foto otimizada deve ter no máximo 8 MB.')
    }

    const [{ data: missao, error: missaoError }, { data: responsavel, error: responsavelError }] = await Promise.all([
      supabaseServer
        .from('ordens_servico')
        .select('id,reserva_id')
        .eq('id', missaoId)
        .maybeSingle(),
      supabaseServer
        .from('usuarios_empresa')
        .select('usuario_id')
        .eq('usuario_id', responsavelUsuarioId)
        .eq('empresa_id', vinculo.empresa_id)
        .eq('ativo', true)
        .in('perfil', ['Administrador', 'Operação', 'Estoque'])
        .maybeSingle()
    ])

    if (missaoError) throw missaoError
    if (responsavelError) throw responsavelError
    if (!missao?.reserva_id) throw new Error('Missão não encontrada ou sem reserva vinculada.')
    if (!responsavel) throw new Error('O responsável selecionado não está ativo na equipe operacional.')

    ocorrenciaId = randomUUID()

    for (const foto of fotos) {
      const fotoId = randomUUID()
      const caminho = `${vinculo.empresa_id}/${missao.reserva_id}/${missaoId}/${ocorrenciaId}/${fotoId}.${extensaoImagem(foto.type)}`
      const { error: uploadError } = await supabaseServer.storage
        .from('ocorrencias-missao')
        .upload(caminho, await foto.arrayBuffer(), {
          contentType: foto.type,
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError
      caminhosEnviados.push(caminho)
    }

    const { data: ocorrencia, error: ocorrenciaError } = await supabaseServer
      .from('ocorrencias_missao')
      .insert({
        id: ocorrenciaId,
        empresa_id: vinculo.empresa_id,
        reserva_id: missao.reserva_id,
        ordem_servico_id: missaoId,
        tipo,
        etapa,
        prioridade,
        status: 'aberta',
        titulo,
        descricao,
        responsavel_usuario_id: responsavelUsuarioId,
        criada_por: usuario.id,
        atualizada_por: usuario.id
      })
      .select('id,tipo,etapa,prioridade,status,titulo,descricao,responsavel_usuario_id,created_at')
      .single()

    if (ocorrenciaError) throw ocorrenciaError

    if (caminhosEnviados.length) {
      const registrosFotos = caminhosEnviados.map(caminho => {
        const foto = fotos[caminhosEnviados.indexOf(caminho)]
        return {
          empresa_id: vinculo.empresa_id,
          ocorrencia_id: ocorrenciaId,
          storage_path: caminho,
          mime_type: foto.type,
          tamanho_bytes: foto.size,
          criada_por: usuario.id
        }
      })
      const { error: fotosError } = await supabaseServer.from('ocorrencias_missao_fotos').insert(registrosFotos)
      if (fotosError) throw fotosError
    }

    caminhosEnviados.length = 0
    ocorrenciaId = ''

    return NextResponse.json({ sucesso: true, ocorrencia }, { status: 201 })
  } catch (error: unknown) {
    if (ocorrenciaId) {
      await supabaseServer.from('ocorrencias_missao').delete().eq('id', ocorrenciaId)
    }
    if (caminhosEnviados.length) {
      await supabaseServer.storage.from('ocorrencias-missao').remove(caminhosEnviados)
    }

    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}
