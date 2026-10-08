import { supabaseServer } from '@/lib/supabaseServer'
import type {
  Orcamento3Persistido,
  SalvarOrcamento3Input
} from '@/lib/application/comercial/orcamento3.types'

function serializarItens(input: SalvarOrcamento3Input) {
  return input.itens.map(item => ({
    tipo_origem: item.tipoOrigem,
    kit_id: item.kitId || null,
    estoque_item_id: item.estoqueItemId || null,
    item_conceitual_id: item.itemConceitualId || null,
    descricao: item.descricao?.trim() || null,
    quantidade: item.quantidade,
    preco_base: item.precoBase ?? null,
    preco_unitario_orcamento: item.precoUnitarioOrcamento ?? null,
    desconto: item.desconto ?? 0,
    observacao: item.observacao?.trim() || null,
    ordem: item.ordem ?? 0
  }))
}

function serializarTaxas(input: SalvarOrcamento3Input) {
  return (input.taxas || []).map(taxa => ({
    descricao: taxa.descricao.trim(),
    valor: taxa.valor,
    tipo: taxa.tipo || 'OUTRA',
    observacao: taxa.observacao?.trim() || null,
    ordem: taxa.ordem ?? 0
  }))
}

export const orcamento3Repository = {
  async salvar(input: SalvarOrcamento3Input): Promise<Orcamento3Persistido> {
    const { data, error } = await supabaseServer.rpc(
      'salvar_orcamento_jornada3_servidor',
      {
        p_empresa_id: input.empresaId,
        p_usuario_id: input.usuarioId,
        p_orcamento_id: input.orcamentoId || null,
        p_versao_esperada: input.versaoEsperada ?? null,
        p_idempotencia: input.idempotencia?.trim() || null,
        p_status: input.status,
        p_origem: input.origem || 'MANUAL',
        p_cliente_id: input.clienteId || null,
        p_contato_nome: input.contatoNome?.trim() || null,
        p_contato_telefone: input.contatoTelefone || null,
        p_contato_email: input.contatoEmail?.trim().toLowerCase() || null,
        p_tema_evento: input.temaEvento?.trim() || null,
        p_data_evento: input.dataEvento || null,
        p_horario_evento: input.horarioEvento?.trim() || null,
        p_data_retirada: input.dataRetirada || null,
        p_horario_retirada: input.horarioRetirada || null,
        p_data_devolucao: input.dataDevolucao || null,
        p_endereco_evento: input.enderecoEvento?.trim() || null,
        p_observacoes: input.observacoes?.trim() || null,
        p_desconto_tipo: input.descontoTipo || 'VALOR',
        p_desconto_valor: input.descontoValor ?? 0,
        p_itens: serializarItens(input),
        p_taxas: serializarTaxas(input)
      }
    )

    if (error) throw error
    return data as Orcamento3Persistido
  }
}
