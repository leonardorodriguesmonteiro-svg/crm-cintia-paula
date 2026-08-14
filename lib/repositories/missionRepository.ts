import { supabaseServer } from '@/lib/supabaseServer'

export const missionRepository = {
  async buscarOrdemCompleta(ordemServicoId: string) {
    const { data, error } = await supabaseServer
      .from('ordens_servico')
      .select(`
        id,
        reserva_id,
        numero,
        status,
        etapa_atual,
        data_prevista,
        iniciada_em,
        concluida_em,
        reservas (
          id,
          data_evento,
          horario_evento,
          endereco_evento,
          clientes (nome),
          kits (nome)
        ),
        ordem_servico_itens (
          id,
          etapa,
          descricao,
          concluido,
          obrigatoria,
          created_at
        ),
        ordem_servico_equipe (
          id,
          funcao_na_os,
          horario_inicio,
          horario_fim,
          equipe (
            id,
            nome,
            funcao
          )
        )
      `)
      .eq('id', ordemServicoId)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async buscarTimeline(reservaId: string) {
    const { data, error } = await supabaseServer
      .from('timeline_global')
      .select('id,titulo,descricao,modulo,created_at')
      .eq('reserva_id', reservaId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return data || []
  },

  async buscarEvidencias(ordemServicoId: string) {
    const { data, error } = await supabaseServer
      .from('evidencias_missao')
      .select('id,tipo,etapa,titulo,descricao,storage_path,mime_type,tamanho_bytes,capturada_em,criada_por')
      .eq('ordem_servico_id', ordemServicoId)
      .order('capturada_em', { ascending: false })

    if (error) throw error
    if (!data?.length) return []

    const caminhos = data.map(item => item.storage_path)
    const usuarios = Array.from(new Set(data.map(item => item.criada_por).filter(Boolean))) as string[]

    const [{ data: urls, error: urlsError }, autoresResposta] = await Promise.all([
      supabaseServer.storage
        .from('evidencias-missao')
        .createSignedUrls(caminhos, 60 * 60),
      usuarios.length
        ? supabaseServer
            .from('usuarios_empresa')
            .select('usuario_id,nome')
            .in('usuario_id', usuarios)
        : Promise.resolve({ data: [], error: null })
    ])

    if (urlsError) throw urlsError
    if (autoresResposta.error) throw autoresResposta.error

    const urlPorCaminho = new Map(
      (urls || []).map(item => [item.path, item.signedUrl])
    )
    const autorPorId = new Map(
      (autoresResposta.data || []).map(item => [item.usuario_id, item.nome])
    )

    return data.map(item => ({
      ...item,
      signed_url: urlPorCaminho.get(item.storage_path) || '',
      autor: item.criada_por ? autorPorId.get(item.criada_por) || 'Equipe operacional' : 'Sistema'
    }))
  },

  async buscarAssinaturas(ordemServicoId: string) {
    const { data, error } = await supabaseServer
      .from('assinaturas_missao')
      .select('id,etapa,nome_assinante,storage_path,assinada_em,registrada_por')
      .eq('ordem_servico_id', ordemServicoId)
      .order('assinada_em', { ascending: true })

    if (error) throw error
    if (!data?.length) return []

    const caminhos = data.map(item => item.storage_path)
    const usuarios = Array.from(new Set(data.map(item => item.registrada_por).filter(Boolean))) as string[]

    const [{ data: urls, error: urlsError }, autoresResposta] = await Promise.all([
      supabaseServer.storage
        .from('assinaturas-missao')
        .createSignedUrls(caminhos, 60 * 60),
      usuarios.length
        ? supabaseServer
            .from('usuarios_empresa')
            .select('usuario_id,nome')
            .in('usuario_id', usuarios)
        : Promise.resolve({ data: [], error: null })
    ])

    if (urlsError) throw urlsError
    if (autoresResposta.error) throw autoresResposta.error

    const urlPorCaminho = new Map(
      (urls || []).map(item => [item.path, item.signedUrl])
    )
    const autorPorId = new Map(
      (autoresResposta.data || []).map(item => [item.usuario_id, item.nome])
    )

    return data.map(item => ({
      ...item,
      signed_url: urlPorCaminho.get(item.storage_path) || '',
      autor: item.registrada_por
        ? autorPorId.get(item.registrada_por) || 'Equipe operacional'
        : 'Sistema'
    }))
  },

  async buscarResponsaveisOperacionais(empresaId: string) {
    const { data, error } = await supabaseServer
      .from('usuarios_empresa')
      .select('usuario_id,nome,perfil')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .in('perfil', ['Administrador', 'Operação', 'Estoque'])
      .order('nome')

    if (error) throw error
    return data || []
  },

  async buscarOcorrencias(ordemServicoId: string) {
    const { data, error } = await supabaseServer
      .from('ocorrencias_missao')
      .select('id,tipo,etapa,prioridade,status,titulo,descricao,responsavel_usuario_id,resolucao,resolvida_em,resolvida_por,criada_por,created_at,updated_at')
      .eq('ordem_servico_id', ordemServicoId)
      .order('created_at', { ascending: false })

    if (error) throw error
    if (!data?.length) return []

    const ids = data.map(item => item.id)
    const { data: fotos, error: fotosError } = await supabaseServer
      .from('ocorrencias_missao_fotos')
      .select('id,ocorrencia_id,storage_path,mime_type,tamanho_bytes')
      .in('ocorrencia_id', ids)
      .order('created_at', { ascending: true })

    if (fotosError) throw fotosError

    const caminhos = (fotos || []).map(item => item.storage_path)
    const usuarios = Array.from(new Set(data.flatMap(item => [
      item.responsavel_usuario_id,
      item.criada_por,
      item.resolvida_por
    ]).filter(Boolean))) as string[]

    const [urlsResposta, autoresResposta] = await Promise.all([
      caminhos.length
        ? supabaseServer.storage.from('ocorrencias-missao').createSignedUrls(caminhos, 60 * 60)
        : Promise.resolve({ data: [], error: null }),
      usuarios.length
        ? supabaseServer.from('usuarios_empresa').select('usuario_id,nome').in('usuario_id', usuarios)
        : Promise.resolve({ data: [], error: null })
    ])

    if (urlsResposta.error) throw urlsResposta.error
    if (autoresResposta.error) throw autoresResposta.error

    const urlPorCaminho = new Map(
      (urlsResposta.data || []).map(item => [item.path, item.signedUrl])
    )
    const autorPorId = new Map(
      (autoresResposta.data || []).map(item => [item.usuario_id, item.nome])
    )

    return data.map(item => ({
      ...item,
      responsavel_nome: item.responsavel_usuario_id
        ? autorPorId.get(item.responsavel_usuario_id) || 'Responsável não identificado'
        : 'Sem responsável',
      criada_por_nome: item.criada_por
        ? autorPorId.get(item.criada_por) || 'Equipe operacional'
        : 'Sistema',
      resolvida_por_nome: item.resolvida_por
        ? autorPorId.get(item.resolvida_por) || 'Equipe operacional'
        : null,
      fotos: (fotos || [])
        .filter(foto => foto.ocorrencia_id === item.id)
        .map(foto => ({
          ...foto,
          signed_url: urlPorCaminho.get(foto.storage_path) || ''
        }))
    }))
  }
}
