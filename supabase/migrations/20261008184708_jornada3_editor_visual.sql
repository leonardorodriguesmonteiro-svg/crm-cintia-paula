-- Adapter for the visual editor: preserves legacy metadata and migrates fees
-- in the same transaction as the existing versioned, audited save operation.
create or replace function public.salvar_orcamento_editor_jornada3_servidor(p_dados jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_registro public.orcamentos%rowtype;
  v_empresa uuid := (p_dados->>'p_empresa_id')::uuid;
  v_oportunidade uuid := (p_dados->>'oportunidade_id')::uuid;
begin
  if nullif(p_dados->>'p_orcamento_id', '') is not null then
    select * into v_registro from public.orcamentos
      where id = (p_dados->>'p_orcamento_id')::uuid and empresa_id = v_empresa
      for update;
    if found and (v_registro.status not in ('RASCUNHO', 'NOVO', 'EM_EDICAO', 'FINALIZADO')
      or v_registro.resposta_cliente is not null or v_registro.reserva_id is not null) then
      raise exception using message = 'Este orçamento não está disponível para edição.', errcode = '42501';
    end if;
  end if;

  v_resultado := public.salvar_orcamento_jornada3_servidor(
    p_empresa_id := (p_dados->>'p_empresa_id')::uuid,
    p_usuario_id := (p_dados->>'p_usuario_id')::uuid,
    p_orcamento_id := (p_dados->>'p_orcamento_id')::uuid,
    p_versao_esperada := (p_dados->>'p_versao_esperada')::integer,
    p_idempotencia := (p_dados->>'p_idempotencia')::text,
    p_status := (p_dados->>'p_status')::text,
    p_origem := (p_dados->>'p_origem')::text,
    p_cliente_id := (p_dados->>'p_cliente_id')::uuid,
    p_contato_nome := (p_dados->>'p_contato_nome')::text,
    p_contato_telefone := (p_dados->>'p_contato_telefone')::text,
    p_contato_email := (p_dados->>'p_contato_email')::text,
    p_tema_evento := (p_dados->>'p_tema_evento')::text,
    p_data_evento := (p_dados->>'p_data_evento')::date,
    p_horario_evento := (p_dados->>'p_horario_evento')::text,
    p_data_retirada := (p_dados->>'p_data_retirada')::date,
    p_horario_retirada := (p_dados->>'p_horario_retirada')::time without time zone,
    p_data_devolucao := (p_dados->>'p_data_devolucao')::date,
    p_endereco_evento := (p_dados->>'p_endereco_evento')::text,
    p_observacoes := (p_dados->>'p_observacoes')::text,
    p_desconto_tipo := (p_dados->>'p_desconto_tipo')::text,
    p_desconto_valor := (p_dados->>'p_desconto_valor')::numeric,
    p_itens := coalesce(p_dados->'p_itens', '[]'::jsonb),
    p_taxas := coalesce(p_dados->'p_taxas', '[]'::jsonb)
  );
  -- A replay must not update metadata or clear legacy fees a second time.
  if not (v_resultado->>'alterado')::boolean then return v_resultado; end if;

  if v_oportunidade is not null and not exists (
    select 1 from public.oportunidades where id = v_oportunidade and empresa_id = v_empresa
      and (cliente_id is null or cliente_id = (p_dados->>'p_cliente_id')::uuid)
  ) then
    raise exception using message = 'Solicitação não encontrada para este cliente e empresa.', errcode = 'P0002';
  end if;

  -- Keep edited descriptions as quote snapshots; catalog records stay unchanged.
  update public.orcamento_itens item
    set descricao = coalesce(nullif(trim(entrada.descricao), ''), item.descricao)
  from jsonb_to_recordset(p_dados->'p_itens') as entrada(descricao text, ordem integer)
  where item.orcamento_id = (v_resultado->>'id')::uuid
    and item.ordem = entrada.ordem;

  -- The rental reference price is distinct from the replacement cost.
  update public.orcamento_itens item
    set preco_base = greatest(coalesce(estoque.valor_locacao, 0), 0)
  from public.estoque_itens estoque
  where item.orcamento_id = (v_resultado->>'id')::uuid
    and item.estoque_item_id = estoque.id;

  update public.orcamentos set
    oportunidade_id = v_oportunidade,
    validade = (p_dados->>'validade')::date,
    acrescimos = 0,
    frete = 0
  where id = (v_resultado->>'id')::uuid and empresa_id = v_empresa
  returning * into v_registro;

  return v_resultado || jsonb_build_object(
    'subtotal', v_registro.subtotal, 'desconto', v_registro.desconto,
    'total_taxas', v_registro.total_taxas, 'total', v_registro.total,
    'versao', v_registro.versao
  );
end;
$$;
revoke all on function public.salvar_orcamento_editor_jornada3_servidor(jsonb) from public, anon, authenticated;
grant execute on function public.salvar_orcamento_editor_jornada3_servidor(jsonb) to service_role;
