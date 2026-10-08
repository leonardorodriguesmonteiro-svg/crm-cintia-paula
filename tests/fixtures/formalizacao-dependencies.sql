CREATE OR REPLACE FUNCTION public.confirmar_assinatura_formalizacao(p_orcamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_orcamento public.orcamentos%rowtype; v_resultado jsonb; v_agora timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'Sua sessão expirou. Entre novamente no ERP.'; end if;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id for update;
  if not found or v_orcamento.contrato_id is null then raise exception 'Formalize a proposta antes de confirmar a assinatura.'; end if;
  update public.contratos set status='Assinado',assinado_em=coalesce(assinado_em,v_agora),observacoes=concat_ws(E'\n',observacoes,'Assinatura confirmada manualmente pelo ERP em '||to_char(v_agora at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||'.') where id=v_orcamento.contrato_id and status<>'Cancelado';
  update public.contrato_versoes set status='Assinado' where contrato_id=v_orcamento.contrato_id;
  update public.orcamentos set contrato_assinado_em=coalesce(contrato_assinado_em,v_agora) where id=p_orcamento_id;
  v_resultado:=public.tentar_confirmar_reserva_formalizada(p_orcamento_id);
  return jsonb_build_object('status',v_resultado->>'status','confirmada',coalesce((v_resultado->>'confirmada')::boolean,false),'mensagem',case when coalesce((v_resultado->>'confirmada')::boolean,false) then 'Contrato assinado, sinal pago e reserva confirmada.' else 'Contrato assinado. Aguardando o pagamento do sinal para confirmar a reserva.' end) || v_resultado;
end;
$function$;
CREATE OR REPLACE FUNCTION public.confirmar_pagamento_sinal_formalizacao(p_orcamento_id uuid, p_forma_pagamento text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_orcamento public.orcamentos%rowtype; v_lancamento public.lancamentos_financeiros%rowtype; v_agora timestamptz:=now(); v_resultado jsonb;
begin
  if auth.uid() is null then raise exception 'Sua sessão expirou. Entre novamente no ERP.'; end if;
  if char_length(trim(coalesce(p_forma_pagamento,'')))<2 then raise exception 'Informe a forma de pagamento do sinal.'; end if;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id for update;
  if not found or v_orcamento.lancamento_sinal_id is null or v_orcamento.reserva_id is null then raise exception 'Formalize a proposta antes de confirmar o sinal.'; end if;
  select * into v_lancamento from public.lancamentos_financeiros where id=v_orcamento.lancamento_sinal_id for update;
  if not found then raise exception 'Cobrança do sinal não encontrada.'; end if;
  update public.lancamentos_financeiros set status='Pago',data_pagamento=(v_agora at time zone 'America/Sao_Paulo')::date,forma_pagamento=trim(p_forma_pagamento) where id=v_lancamento.id;
  insert into public.recebimentos (reserva_id,lancamento_id,valor,data_recebimento,forma_pagamento,status,observacoes)
  values (v_orcamento.reserva_id,v_lancamento.id,v_lancamento.valor,(v_agora at time zone 'America/Sao_Paulo')::date,trim(p_forma_pagamento),'Pago','Sinal registrado pela formalização comercial V2.')
  on conflict (lancamento_id) where lancamento_id is not null do update set valor=excluded.valor,data_recebimento=excluded.data_recebimento,forma_pagamento=excluded.forma_pagamento,status='Pago',observacoes=excluded.observacoes;
  update public.reservas set valor_sinal=v_lancamento.valor,status_pagamento='Sinal pago',data_pagamento_sinal=(v_agora at time zone 'America/Sao_Paulo')::date,forma_pagamento_sinal=trim(p_forma_pagamento) where id=v_orcamento.reserva_id;
  update public.orcamentos set sinal_pago_em=coalesce(sinal_pago_em,v_agora) where id=p_orcamento_id;
  v_resultado:=public.tentar_confirmar_reserva_formalizada(p_orcamento_id);
  return jsonb_build_object('status',v_resultado->>'status','confirmada',coalesce((v_resultado->>'confirmada')::boolean,false),'mensagem',case when coalesce((v_resultado->>'confirmada')::boolean,false) then 'Sinal recebido, contrato assinado e reserva confirmada.' else 'Sinal recebido. Aguardando a assinatura do contrato para confirmar a reserva.' end) || v_resultado;
end;
$function$;
CREATE OR REPLACE FUNCTION public.tentar_confirmar_reserva_formalizada(p_orcamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_orcamento public.orcamentos%rowtype;
  v_reserva public.reservas%rowtype;
  v_contrato_assinado boolean := false;
  v_sinal_pago boolean := false;
  v_disponibilidade jsonb;
  v_motivo text;
  v_status text;
begin
  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Proposta não encontrada.';
  end if;

  if v_orcamento.reserva_id is null then
    return jsonb_build_object('confirmada',false,'nova_confirmacao',false,'status',v_orcamento.formalizacao_status,'motivo','Reserva provisória ainda não foi criada.');
  end if;

  select * into v_reserva
  from public.reservas
  where id = v_orcamento.reserva_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Reserva provisória não encontrada.';
  end if;

  select coalesce(contrato.status = 'Assinado', false)
  into v_contrato_assinado
  from public.contratos contrato
  where contrato.id = v_orcamento.contrato_id;

  select coalesce(lancamento.status = 'Pago', false)
  into v_sinal_pago
  from public.lancamentos_financeiros lancamento
  where lancamento.id = v_orcamento.lancamento_sinal_id;

  v_contrato_assinado := coalesce(v_contrato_assinado, false);
  v_sinal_pago := coalesce(v_sinal_pago, false);

  if not v_contrato_assinado or not v_sinal_pago then
    v_status := case when not v_contrato_assinado then 'AGUARDANDO_ASSINATURA' else 'AGUARDANDO_PAGAMENTO' end;
    update public.orcamentos
    set formalizacao_status=v_status,formalizacao_bloqueio=null,hold_expira_em=null
    where id=v_orcamento.id and formalizacao_status is distinct from 'RESERVA_CONFIRMADA';
    return jsonb_build_object('confirmada',false,'nova_confirmacao',false,'status',v_status,'contrato_assinado',v_contrato_assinado,'sinal_pago',v_sinal_pago);
  end if;

  if v_reserva.status = 'Confirmada' then
    update public.orcamentos
    set formalizacao_status='RESERVA_CONFIRMADA',formalizacao_bloqueio=null,hold_expira_em=null,formalizado_em=coalesce(formalizado_em,now())
    where id=v_orcamento.id;
    return jsonb_build_object('confirmada',true,'nova_confirmacao',false,'status','RESERVA_CONFIRMADA','reserva_id',v_reserva.id,'contrato_assinado',true,'sinal_pago',true);
  end if;

  perform k.id
  from public.kits k
  where k.id in (
    select distinct oi.kit_id
    from public.orcamento_itens oi
    where oi.orcamento_id=v_orcamento.id and oi.kit_id is not null
  )
  order by k.id
  for update;

  perform e.id
  from public.estoque_itens e
  where e.id in (
    select oi.estoque_item_id
    from public.orcamento_itens oi
    where oi.orcamento_id=v_orcamento.id and oi.estoque_item_id is not null
    union
    select kc.item_id
    from public.orcamento_itens oi
    join public.kit_composicao kc on kc.kit_id=oi.kit_id
    where oi.orcamento_id=v_orcamento.id and oi.kit_id is not null and kc.item_id is not null
  )
  order by e.id
  for update;

  update public.orcamentos
  set formalizacao_status='PRONTA_PARA_CONFIRMAR',formalizacao_bloqueio=null,hold_expira_em=null
  where id=v_orcamento.id;

  v_disponibilidade := public.verificar_disponibilidade_orcamento_confirmacao(v_orcamento.id,v_reserva.id);
  if not coalesce((v_disponibilidade->>'disponivel')::boolean,false) then
    v_motivo:=coalesce(v_disponibilidade->>'motivo','A disponibilidade precisa ser revisada antes da confirmação.');
    update public.orcamentos set formalizacao_bloqueio=v_motivo where id=v_orcamento.id;
    return jsonb_build_object('confirmada',false,'nova_confirmacao',false,'status','PRONTA_PARA_CONFIRMAR','bloqueada',true,'motivo',v_motivo,'contrato_assinado',true,'sinal_pago',true);
  end if;

  update public.reservas
  set status='Confirmada',status_comercial='Confirmada',status_operacional='Aguardando operação'
  where id=v_reserva.id and status is distinct from 'Confirmada';

  update public.orcamentos
  set formalizacao_status='RESERVA_CONFIRMADA',formalizacao_bloqueio=null,hold_expira_em=null,formalizado_em=coalesce(formalizado_em,now())
  where id=v_orcamento.id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades set etapa='Fechado',motivo_perda=null
    where id=v_orcamento.oportunidade_id and etapa<>'Perdido';
  end if;

  return jsonb_build_object('confirmada',true,'nova_confirmacao',true,'status','RESERVA_CONFIRMADA','reserva_id',v_reserva.id,'contrato_assinado',true,'sinal_pago',true);
end;
$function$;
