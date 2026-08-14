import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { exigirPerfis, respostaErroAdministrativo } from '@/lib/server/adminAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS = ['aberta', 'em_acompanhamento', 'resolvida'] as const
const PRIORIDADES = ['baixa', 'media', 'alta', 'critica'] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ocorrenciaId: string }> }
) {
  try {
    const { usuario, vinculo } = await exigirPerfis(request, ['Operação', 'Estoque'])
    const { id: missaoId, ocorrenciaId } = await params
    const corpo = await request.json().catch(() => ({}))
    const status = String(corpo.status || '')
    const prioridade = String(corpo.prioridade || '')
    const responsavelUsuarioId = String(corpo.responsavel_usuario_id || '')
    const resolucao = String(corpo.resolucao || '').trim().slice(0, 2000)

    if (!STATUS.includes(status as (typeof STATUS)[number])) throw new Error('Selecione um status válido.')
    if (!PRIORIDADES.includes(prioridade as (typeof PRIORIDADES)[number])) throw new Error('Selecione uma prioridade válida.')
    if (!responsavelUsuarioId) throw new Error('Selecione o responsável pelo acompanhamento.')
    if (status === 'resolvida' && resolucao.length < 5) throw new Error('Descreva a solução antes de resolver a ocorrência.')

    const [{ data: ocorrencia, error: ocorrenciaError }, { data: responsavel, error: responsavelError }] = await Promise.all([
      supabaseServer
        .from('ocorrencias_missao')
        .select('id')
        .eq('id', ocorrenciaId)
        .eq('ordem_servico_id', missaoId)
        .eq('empresa_id', vinculo.empresa_id)
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

    if (ocorrenciaError) throw ocorrenciaError
    if (responsavelError) throw responsavelError
    if (!ocorrencia) throw new Error('Ocorrência não encontrada nesta missão.')
    if (!responsavel) throw new Error('O responsável selecionado não está ativo na equipe operacional.')

    const { data: atualizada, error: atualizarError } = await supabaseServer
      .from('ocorrencias_missao')
      .update({
        status,
        prioridade,
        responsavel_usuario_id: responsavelUsuarioId,
        resolucao: resolucao || null,
        atualizada_por: usuario.id,
        resolvida_por: status === 'resolvida' ? usuario.id : null,
        resolvida_em: status === 'resolvida' ? new Date().toISOString() : null
      })
      .eq('id', ocorrenciaId)
      .select('id,status,prioridade,responsavel_usuario_id,resolucao,resolvida_em,updated_at')
      .single()

    if (atualizarError) throw atualizarError

    return NextResponse.json({ sucesso: true, ocorrencia: atualizada })
  } catch (error: unknown) {
    const falha = respostaErroAdministrativo(error)
    return NextResponse.json(
      { sucesso: false, erro: falha.mensagem },
      { status: falha.status }
    )
  }
}
