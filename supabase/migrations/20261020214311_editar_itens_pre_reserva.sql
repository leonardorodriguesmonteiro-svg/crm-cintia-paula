-- Salva as linhas e o desconto juntos, mantendo os preços do catálogo intactos.
create or replace function public.editar_itens_pre_reserva_servidor(
  p_empresa_id uuid, p_oportunidade_id uuid, p_usuario_id uuid,
  p_versao_esperada integer, p_desconto_tipo text, p_desconto_valor numeric,
  p_itens jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_pedido public.oportunidades%rowtype;
  v_item jsonb;
  v_id uuid;
  v_ids uuid[] := '{}';
  v_ordem integer := 0;
  v_tipo text;
  v_kit uuid;
  v_estoque uuid;
begin
  if not exists (select 1 from public.usuarios_empresa
    where usuario_id = p_usuario_id and empresa_id = p_empresa_id
      and ativo and perfil in ('Administrador', 'Comercial')) then
    raise exception using errcode='42501', message='Usuário sem permissão comercial nesta empresa.';
  end if;
  select * into v_pedido from public.oportunidades
    where id=p_oportunidade_id and empresa_id=p_empresa_id for update;
  if not found then
    raise exception using errcode='P0002', message='Solicitação não encontrada.';
  end if;
  if p_versao_esperada is null or v_pedido.versao <> p_versao_esperada then
    raise exception using errcode='40001', message='A solicitação foi alterada. Atualize a tela e revise os valores antes de salvar.';
  end if;
  if v_pedido.etapa not in ('RECEBIDA','EM_ANALISE','AJUSTE_SOLICITADO','APROVADA') then
    raise exception using errcode='23514', message='Esta solicitação não permite mais ajustes comerciais.';
  end if;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception using errcode='22023', message='Informe os itens do pedido.';
  end if;
  if jsonb_array_length(p_itens) not between 1 and 100 then
    raise exception using errcode='22023', message='Informe de 1 a 100 itens.';
  end if;
  perform set_config('app.usuario_id', p_usuario_id::text, true);
  for v_item in select value from jsonb_array_elements(p_itens) loop
    if jsonb_typeof(v_item) <> 'object'
      or coalesce(length(trim(v_item->>'nome_snapshot')),0) not between 2 and 300
      or jsonb_typeof(v_item->'quantidade') is distinct from 'number'
      or jsonb_typeof(v_item->'valor_referencia') is distinct from 'number' then
      raise exception using errcode='22023', message='Informe descrição, quantidade e preço válidos em cada item.';
    end if;
    if (v_item->>'quantidade')::numeric <= 0
      or (v_item->>'quantidade')::numeric > 99999999.99
      or round((v_item->>'quantidade')::numeric,2) <> (v_item->>'quantidade')::numeric
      or (v_item->>'valor_referencia')::numeric < 0
      or (v_item->>'valor_referencia')::numeric > 9999999999.99
      or round((v_item->>'valor_referencia')::numeric,2) <> (v_item->>'valor_referencia')::numeric then
      raise exception using errcode='22023', message='Quantidade deve ser positiva e preço não negativo, com até duas casas decimais.';
    end if;
    v_id := nullif(v_item->>'id','')::uuid;
    if v_id is not null then
      if v_id = any(v_ids) then
        raise exception using errcode='22023', message='Item duplicado no pedido.';
      end if;
      update public.oportunidade_itens set
        nome_snapshot=trim(v_item->>'nome_snapshot'),
        quantidade=(v_item->>'quantidade')::numeric,
        valor_referencia=(v_item->>'valor_referencia')::numeric,
        observacoes=nullif(v_item->>'observacoes',''), ordem=v_ordem, updated_at=now()
      where id=v_id and oportunidade_id=p_oportunidade_id and empresa_id=p_empresa_id;
      if not found then
        raise exception using errcode='42501', message='Item não pertence a esta solicitação.';
      end if;
    else
      v_tipo := v_item->>'tipo';
      v_kit := nullif(v_item->>'kit_id','')::uuid;
      v_estoque := nullif(v_item->>'estoque_item_id','')::uuid;
      if v_tipo = 'KIT' and v_kit is not null and v_estoque is null then
        if not exists(select 1 from public.kits where id=v_kit and status is distinct from 'Inativo') then
          raise exception using errcode='42501', message='Kit indisponível no catálogo.';
        end if;
      elsif v_tipo = 'ITEM_ESTOQUE' and v_estoque is not null and v_kit is null then
        if not exists(select 1 from public.estoque_itens where id=v_estoque and status is distinct from 'Inativo') then
          raise exception using errcode='42501', message='Item indisponível no catálogo.';
        end if;
      else
        raise exception using errcode='22023', message='Selecione um item do catálogo.';
      end if;
      insert into public.oportunidade_itens(empresa_id,oportunidade_id,tipo,kit_id,estoque_item_id,nome_snapshot,quantidade,valor_referencia,observacoes,ordem)
      values(p_empresa_id,p_oportunidade_id,v_tipo,v_kit,v_estoque,trim(v_item->>'nome_snapshot'),(v_item->>'quantidade')::numeric,(v_item->>'valor_referencia')::numeric,nullif(v_item->>'observacoes',''),v_ordem)
      returning id into v_id;
    end if;
    v_ids := array_append(v_ids,v_id);
    v_ordem := v_ordem+1;
  end loop;
  delete from public.oportunidade_itens
    where oportunidade_id=p_oportunidade_id and empresa_id=p_empresa_id and not(id=any(v_ids));
  -- Os triggers de total podem incrementar a versão durante esta transação.
  select versao into v_pedido.versao from public.oportunidades where id=p_oportunidade_id;
  return public.ajustar_valores_pre_reserva_servidor(p_empresa_id,p_oportunidade_id,p_usuario_id,v_pedido.versao,p_desconto_tipo,p_desconto_valor);
end;
$$;
revoke all on function public.editar_itens_pre_reserva_servidor(uuid,uuid,uuid,integer,text,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.editar_itens_pre_reserva_servidor(uuid,uuid,uuid,integer,text,numeric,jsonb) to service_role;
