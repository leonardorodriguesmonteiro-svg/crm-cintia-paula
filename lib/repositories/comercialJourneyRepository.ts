import { supabaseServer } from '@/lib/supabaseServer'
import type {
  CriarPreReservaInput,
  PreReservaPersistida,
  TransicionarPreReservaInput
} from '@/lib/application/comercial/jornadaComercial.types'

function serializarItens(itens: CriarPreReservaInput['itens']) {
  return itens.map(item => ({
    tipo: item.tipo,
    kit_id: item.tipo === 'KIT' ? item.kitId : null,
    estoque_item_id:
      item.tipo === 'ITEM_ESTOQUE' ? item.estoqueItemId : null,
    quantidade: item.quantidade,
    observacoes: item.observacoes || null
  }))
}

export const comercialJourneyRepository = {
  async consumirLimitePublico(
    empresaId: string,
    chaveHash: string,
    limite: number,
    janelaSegundos: number
  ) {
    const { data, error } = await supabaseServer.rpc(
      'consumir_limite_pre_reserva_servidor',
      {
        p_empresa_id: empresaId,
        p_chave_hash: chaveHash,
        p_limite: limite,
        p_janela_segundos: janelaSegundos
      }
    )

    if (error) throw error
    return data === true
  },

  async criarPreReserva(input: CriarPreReservaInput) {
    const { data, error } = await supabaseServer.rpc(
      'criar_pre_reserva_servidor',
      {
        p_empresa_id: input.empresaId,
        p_usuario_id: input.usuarioId || null,
        p_cliente_id: input.clienteId || null,
        p_nome_contato: input.nomeContato,
        p_celular: input.celular,
        p_email: input.email || null,
        p_origem: input.origem || 'Site',
        p_origem_externa_id: input.origemExternaId || null,
        p_data_evento: input.dataEvento || null,
        p_interesse: input.interesse || null,
        p_itens: serializarItens(input.itens)
      }
    )

    if (error) throw error
    return data as {
      id: string
      numero: number
      status: string
      criada: boolean
    }
  },

  async buscarPreReserva(
    oportunidadeId: string,
    empresaId: string
  ): Promise<PreReservaPersistida | null> {
    const { data, error } = await supabaseServer
      .from('oportunidades')
      .select('id,numero,empresa_id,etapa,versao')
      .eq('id', oportunidadeId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (error) throw error
    return data as PreReservaPersistida | null
  },

  async transicionarPreReserva(input: TransicionarPreReservaInput) {
    const { data, error } = await supabaseServer.rpc(
      'transicionar_pre_reserva_servidor',
      {
        p_empresa_id: input.empresaId,
        p_oportunidade_id: input.oportunidadeId,
        p_usuario_id: input.usuarioId,
        p_versao_esperada: input.versaoEsperada,
        p_proximo_status: input.proximoStatus,
        p_observacao: input.observacao || null
      }
    )

    if (error) throw error
    return data as {
      id: string
      numero: number
      status_anterior: string
      status: string
      versao: number
    }
  },

  async registrarRespostaProposta(
    token: string,
    decisao: 'Aprovado' | 'Recusado',
    nome: string,
    observacao?: string | null
  ) {
    const { data, error } = await supabaseServer.rpc(
      'registrar_resposta_publica_orcamento',
      {
        p_token: token,
        p_decisao: decisao,
        p_nome: nome,
        p_observacao: observacao || null
      }
    )
    if (error) throw error
    return data as {
      id: string
      empresa_id: string | null
      oportunidade_id: string | null
      numero: number
      status: string
      decisao: string
      respondido_em: string
      ja_respondido: boolean
    }
  },

  async completarDadosClienteProposta(input: {
    token: string
    cpf: string
    endereco: string
    bairro: string
    cidade: string
    email?: string | null
  }) {
    const { data, error } = await supabaseServer.rpc(
      'completar_dados_cliente_proposta_servidor',
      {
        p_token: input.token,
        p_cpf: input.cpf,
        p_endereco: input.endereco,
        p_bairro: input.bairro,
        p_cidade: input.cidade,
        p_email: input.email || null
      }
    )
    if (error) throw error
    return data as {
      orcamento_id: string
      empresa_id: string | null
      oportunidade_id: string | null
      numero: number
      status: string
      ja_completo: boolean
    }
  },

  async enviarProposta(input: {
    usuarioId: string
    empresaId: string
    orcamentoId: string
  }) {
    const { data, error } = await supabaseServer.rpc('enviar_proposta_servidor', {
      p_usuario_id: input.usuarioId,
      p_empresa_id: input.empresaId,
      p_orcamento_id: input.orcamentoId
    })
    if (error) throw error
    return data as {
      id: string
      numero: number
      oportunidade_id: string
      status: string
      ja_enviada: boolean
    }
  },

  async cancelarEnvioProposta(input: {
    usuarioId: string
    empresaId: string
    orcamentoId: string
  }) {
    const { data, error } = await supabaseServer.rpc(
      'cancelar_envio_proposta_servidor',
      {
        p_usuario_id: input.usuarioId,
        p_empresa_id: input.empresaId,
        p_orcamento_id: input.orcamentoId
      }
    )
    if (error) throw error
    return data as {
      id: string
      numero: number
      destino_anterior: string | null
      status: string
    }
  }
}
