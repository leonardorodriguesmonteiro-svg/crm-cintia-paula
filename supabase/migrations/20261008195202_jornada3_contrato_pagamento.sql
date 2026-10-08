-- Preserve the accepted financial snapshot, including non-stock lines.
CREATE OR REPLACE FUNCTION public.formalizar_orcamento_aprovado(p_orcamento_id uuid, p_valor_sinal numeric, p_vencimento date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_orcamento public.orcamentos%rowtype;
  v_reserva_id uuid;
  v_contrato_id uuid;
  v_lancamento_id uuid;
  v_numero_contrato text;
  v_kit_id uuid;
  v_total_snapshot numeric;
  v_linha record;
  v_ordem integer := 0;
  v_disponibilidade jsonb;
  v_status_formalizacao text;
begin
  if auth.uid() is null then raise exception 'Sua sessão expirou. Entre novamente no ERP.'; end if;

  select * into v_orcamento from public.orcamentos where id=p_orcamento_id for update;
  if not found then raise exception 'Orçamento não encontrado.'; end if;
  if v_orcamento.status not in ('ACEITA','Aprovado') then raise exception 'O cliente precisa aceitar a proposta antes da formalização.'; end if;
  if v_orcamento.status='ACEITA' and (v_orcamento.dados_cliente_completos_em is null or v_orcamento.cliente_id is null) then
    raise exception 'Complete os dados do cliente antes de gerar o contrato.';
  end if;
  if v_orcamento.cliente_id is null then raise exception 'Não foi possível identificar o cliente desta proposta.'; end if;
  if v_orcamento.data_evento is null then raise exception 'Informe a data do evento antes de formalizar a proposta.'; end if;
  if coalesce(p_valor_sinal,0)<=0 then raise exception 'Informe um valor de sinal maior que zero.'; end if;
  if p_valor_sinal>v_orcamento.total then raise exception 'O sinal não pode ser maior que o total da proposta.'; end if;
  if p_vencimento is null then raise exception 'Informe a data de vencimento do sinal.'; end if;

  if not exists(select 1 from public.orcamento_itens where orcamento_id=p_orcamento_id) then
    raise exception 'Inclua ao menos um item antes de formalizar.';
  end if;

  if exists (
    select 1 from public.orcamento_itens item
    where item.orcamento_id=p_orcamento_id
      and item.kit_id is not null
      and item.quantidade<>1
  ) then
    raise exception 'Cada KIT pronto deve ser incluído em uma linha individual da reserva.';
  end if;

  if exists (
    select 1 from public.orcamento_itens item
    where item.orcamento_id=p_orcamento_id
      and item.kit_id is not null
    group by item.kit_id having count(*)>1
  ) then
    raise exception 'O mesmo KIT pronto não pode aparecer em mais de uma linha da proposta.';
  end if;

  v_disponibilidade := public.verificar_disponibilidade_orcamento_confirmacao(p_orcamento_id, v_orcamento.reserva_id);
  if not coalesce((v_disponibilidade->>'disponivel')::boolean,false) then
    raise exception '%', coalesce(v_disponibilidade->>'motivo','A seleção não está disponível no período.');
  end if;

  v_reserva_id:=v_orcamento.reserva_id;
  if v_reserva_id is null then
    select reserva.id into v_reserva_id
    from public.reservas reserva
    where reserva.orcamento_id=p_orcamento_id
    order by reserva.created_at limit 1;
  end if;

  select item.kit_id into v_kit_id
  from public.orcamento_itens item
  where item.orcamento_id=p_orcamento_id and item.kit_id is not null
  order by item.created_at limit 1;

  if v_reserva_id is null then
    insert into public.reservas (
      cliente_id,kit_id,data_evento,horario_evento,endereco_evento,valor_total,valor_sinal,status,observacoes,
      data_retirada,horario_retirada,data_devolucao,status_comercial,status_operacional,status_pagamento,orcamento_id
    ) values (
      v_orcamento.cliente_id,v_kit_id,v_orcamento.data_evento,v_orcamento.horario_evento,v_orcamento.endereco_evento,v_orcamento.total,p_valor_sinal,'Pendente',
      concat_ws(E'\n\n','Reserva provisória gerada pela proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.','O estoque será bloqueado somente após assinatura do contrato e pagamento do sinal.',nullif(v_orcamento.observacoes,'')),
      coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),v_orcamento.horario_retirada,coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
      'Aguardando formalização','Aguardando confirmação','Pendente',p_orcamento_id
    ) returning id into v_reserva_id;

    for v_linha in
      select * from public.orcamento_itens item
      where item.orcamento_id=p_orcamento_id
      order by item.ordem, item.created_at, item.id
    loop
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (
        reserva_id,kit_id,estoque_item_id,descricao,quantidade,valor_unitario,ordem
      ) values (
        v_reserva_id,
        v_linha.kit_id,
        v_linha.estoque_item_id,
        v_linha.descricao || case when v_linha.tipo_origem='CONCEITUAL' then ' (item conceitual: aquisição ou produção necessária)' else '' end,
        case when v_linha.kit_id is not null then 1 else v_linha.quantidade end,
        coalesce(v_linha.preco_unitario_orcamento,v_linha.valor_unitario),
        v_ordem
      );
      if coalesce(v_linha.desconto,0)>0 then
        v_ordem:=v_ordem+1;
        insert into public.reserva_itens(reserva_id,descricao,quantidade,valor_unitario,ordem)
        values(v_reserva_id,'Desconto do item: '||v_linha.descricao,1,-v_linha.desconto,v_ordem);
      end if;
    end loop;

    for v_linha in select * from public.orcamento_taxas where orcamento_id=p_orcamento_id order by ordem,id loop
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens(reserva_id,descricao,quantidade,valor_unitario,ordem)
      values(v_reserva_id,v_linha.descricao,1,v_linha.valor,v_ordem);
    end loop;

    if coalesce(v_orcamento.desconto,0)>0 then
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem)
      values (v_reserva_id,'Desconto comercial',1,-v_orcamento.desconto,v_ordem);
    end if;
    if coalesce(v_orcamento.acrescimos,0)>0 then
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem)
      values (v_reserva_id,'Acréscimos',1,v_orcamento.acrescimos,v_ordem);
    end if;
    if coalesce(v_orcamento.frete,0)>0 then
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem)
      values (v_reserva_id,'Frete',1,v_orcamento.frete,v_ordem);
    end if;
  else
    update public.reservas
    set cliente_id=v_orcamento.cliente_id,
        valor_sinal=p_valor_sinal,
        data_retirada=coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),
        horario_retirada=v_orcamento.horario_retirada,
        data_devolucao=coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
        status_pagamento=case when status_pagamento in ('Pago','Quitado','Sinal pago') then status_pagamento else 'Pendente' end
    where id=v_reserva_id;
  end if;

  select coalesce(sum(subtotal),0) into v_total_snapshot from public.reserva_itens where reserva_id=v_reserva_id;
  if v_total_snapshot <> v_orcamento.total then
    raise exception 'Os itens do contrato não correspondem ao total aceito. Revise a composição antes de formalizar.';
  end if;

  v_contrato_id:=v_orcamento.contrato_id;
  if v_contrato_id is null then
    select contrato.id into v_contrato_id
    from public.contratos contrato
    where contrato.reserva_id=v_reserva_id
    order by contrato.created_at limit 1;
  end if;
  if v_contrato_id is null then
    v_numero_contrato:='CTR-'||extract(year from (now() at time zone 'America/Sao_Paulo'))::integer::text||'-'||lpad(v_orcamento.numero::text,4,'0');
    insert into public.contratos (reserva_id,numero_contrato,status,observacoes)
    values (v_reserva_id,v_numero_contrato,'Gerado','Contrato gerado automaticamente na formalização da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.')
    returning id into v_contrato_id;
    insert into public.contrato_versoes (contrato_id,versao,conteudo,status)
    values (v_contrato_id,1,'Contrato gerado automaticamente a partir da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.','Rascunho');
  end if;

  v_lancamento_id:=v_orcamento.lancamento_sinal_id;
  if v_lancamento_id is null then
    select lancamento.id into v_lancamento_id
    from public.lancamentos_financeiros lancamento
    where lancamento.reserva_id=v_reserva_id and lancamento.categoria='Sinal' and lancamento.status<>'Cancelado'
    order by lancamento.created_at limit 1;
  end if;
  if v_lancamento_id is null then
    insert into public.lancamentos_financeiros (reserva_id,tipo,descricao,categoria,valor,data_vencimento,status,observacoes)
    values (v_reserva_id,'Receita','Sinal da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0'),'Sinal',p_valor_sinal,p_vencimento,'Pendente','Cobrança criada na formalização comercial V2.')
    returning id into v_lancamento_id;
  else
    update public.lancamentos_financeiros
    set valor=p_valor_sinal,data_vencimento=p_vencimento
    where id=v_lancamento_id and status='Pendente';
  end if;

  select case
    when contrato.status='Assinado' then case when lancamento.status='Pago' then 'PRONTA_PARA_CONFIRMAR' else 'AGUARDANDO_PAGAMENTO' end
    when contrato.email_enviado_em is not null or contrato.status='Enviado' then 'AGUARDANDO_ASSINATURA'
    else 'CONTRATO_GERADO'
  end into v_status_formalizacao
  from public.contratos contrato
  left join public.lancamentos_financeiros lancamento on lancamento.id=v_lancamento_id
  where contrato.id=v_contrato_id;

  update public.orcamentos
  set reserva_id=v_reserva_id,
      contrato_id=v_contrato_id,
      lancamento_sinal_id=v_lancamento_id,
      valor_sinal_formalizacao=p_valor_sinal,
      vencimento_sinal=p_vencimento,
      formalizacao_status=coalesce(v_status_formalizacao,'CONTRATO_GERADO'),
      formalizacao_bloqueio=null,
      hold_expira_em=null
  where id=p_orcamento_id;

  return jsonb_build_object(
    'reserva_id',v_reserva_id,
    'contrato_id',v_contrato_id,
    'lancamento_sinal_id',v_lancamento_id,
    'status',coalesce(v_status_formalizacao,'CONTRATO_GERADO'),
    'mensagem','Reserva provisória, contrato e cobrança preparados. O estoque será bloqueado somente na confirmação definitiva.'
  );
end;
$function$;

create or replace function public.executar_formalizacao_servidor(
  p_usuario_id uuid,p_orcamento_id uuid,p_acao text,p_valor_sinal numeric default null,p_vencimento date default null,p_forma_pagamento text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_perfil text;
  v_resultado jsonb := '{}'::jsonb;
  v_repetida boolean := false;
begin
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id for update;
  if not found then raise exception using errcode='P0002',message='Proposta não encontrada.'; end if;
  select perfil into v_perfil from public.usuarios_empresa
    where usuario_id=p_usuario_id and empresa_id=v_orcamento.empresa_id and ativo
    order by case perfil when 'Administrador' then 0 when 'Comercial' then 1 else 2 end limit 1;
  if v_perfil is null or
    (p_acao in ('formalizar','confirmar_assinatura') and v_perfil not in ('Administrador','Comercial')) or
    (p_acao='confirmar_sinal' and v_perfil not in ('Administrador','Comercial','Financeiro')) then
    raise exception using errcode='42501',message='Usuário sem permissão para formalizar esta proposta.';
  end if;
  if p_acao is null or p_acao not in ('formalizar','confirmar_assinatura','confirmar_sinal') then
    raise exception using errcode='22023',message='Ação de formalização inválida.';
  end if;
  if v_orcamento.status is distinct from 'ACEITA' then
    raise exception using errcode='23514',message='A proposta precisa estar aceita.';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  perform set_config('app.usuario_id',p_usuario_id::text,true);
  if p_acao='formalizar' then
    if v_orcamento.contrato_id is not null and v_orcamento.reserva_id is not null and v_orcamento.lancamento_sinal_id is not null then
      v_repetida:=true;
    else
      if v_orcamento.formalizacao_status <> 'DADOS_COMPLETOS' or v_orcamento.dados_cliente_completos_em is null or v_orcamento.cliente_id is null then
        raise exception using errcode='23514',message='Complete os dados do cliente antes de gerar o contrato.';
      end if;
      v_resultado:=public.formalizar_orcamento_aprovado(p_orcamento_id,p_valor_sinal,p_vencimento);
    end if;
  elsif p_acao='confirmar_assinatura' then
    v_resultado:=public.confirmar_assinatura_formalizacao(p_orcamento_id);
  elsif p_acao='confirmar_sinal' then
    v_resultado:=public.confirmar_pagamento_sinal_formalizacao(p_orcamento_id,p_forma_pagamento);
  end if;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id;
  return v_resultado || jsonb_build_object(
    'status',v_orcamento.formalizacao_status,
    'reserva_id',v_orcamento.reserva_id,'contrato_id',v_orcamento.contrato_id,
    'lancamento_sinal_id',v_orcamento.lancamento_sinal_id,
    'ja_formalizada',v_repetida,
    'mensagem',case
      when v_repetida then 'Contrato e cobrança já preparados. Os valores existentes foram preservados.'
      when coalesce((v_resultado->>'bloqueada')::boolean,false) then v_resultado->>'motivo'
      when v_orcamento.formalizacao_status='CONTRATO_GERADO' then 'Contrato e cobrança preparados. Aguardando envio e assinatura.'
      when v_orcamento.formalizacao_status='AGUARDANDO_ASSINATURA' then 'Aguardando assinatura do contrato.'
      when v_orcamento.formalizacao_status='AGUARDANDO_PAGAMENTO' then 'Contrato assinado. Aguardando pagamento do sinal.'
      when v_orcamento.formalizacao_status='RESERVA_CONFIRMADA' then 'Formalização concluída e reserva confirmada.'
      else coalesce(v_resultado->>'mensagem','Formalização atualizada.') end
  );
end;
$$;
revoke all on function public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text) from public,anon,authenticated;
grant execute on function public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text) to service_role;
revoke all on function public.formalizar_orcamento_aprovado(uuid,numeric,date) from public,anon,authenticated;
