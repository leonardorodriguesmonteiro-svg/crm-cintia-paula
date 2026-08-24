-- Sprint Comercial 1.1 - Formalização V2
-- Consolida o fluxo: proposta aceita -> dados completos -> contrato -> assinatura
-- -> pagamento -> reserva confirmada.

alter table public.orcamentos
  add column if not exists hold_expira_em timestamptz,
  add column if not exists formalizacao_bloqueio text;

create index if not exists orcamentos_hold_ativo_idx
on public.orcamentos (hold_expira_em, data_evento)
where status = 'ACEITA';

create or replace function public.gerenciar_hold_orcamento_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'ACEITA' and old.status is distinct from 'ACEITA' then
    new.hold_expira_em := now() + interval '24 hours';
    new.formalizacao_bloqueio := null;
  elsif new.status in ('RECUSADA', 'EXPIRADA', 'CANCELADA') then
    new.hold_expira_em := null;
  end if;
  return new;
end;
$$;

drop trigger if exists gerenciar_hold_orcamento_v2 on public.orcamentos;
create trigger gerenciar_hold_orcamento_v2
before update of status on public.orcamentos
for each row execute function public.gerenciar_hold_orcamento_v2();

update public.orcamentos
set hold_expira_em = now() + interval '24 hours'
where status = 'ACEITA'
  and hold_expira_em is null
  and formalizacao_status is distinct from 'RESERVA_CONFIRMADA';

create or replace function public.verificar_disponibilidade_kit_com_hold(
  p_kit_id uuid,
  p_inicio date,
  p_fim date,
  p_reserva_ignorar uuid,
  p_orcamento_ignorar uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflito text;
  v_capacidade integer;
  v_reservas_kit integer := 0;
  v_holds_kit integer := 0;
begin
  if p_inicio is null or p_fim is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Informe o período da reserva.');
  end if;
  if p_fim < p_inicio then
    return jsonb_build_object('disponivel', false, 'motivo', 'A data final não pode ser anterior à data inicial.');
  end if;
  select greatest(coalesce(quantidade, 1), 1)
  into v_capacidade
  from public.kits
  where id = p_kit_id;
  if v_capacidade is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Kit não encontrado.');
  end if;

  select count(*)::integer
  into v_reservas_kit
  from public.reservas reserva
  where reserva.status in ('Confirmada', 'Em andamento')
    and (p_reserva_ignorar is null or reserva.id <> p_reserva_ignorar)
    and coalesce(reserva.data_retirada, reserva.data_evento, reserva.data_festa) is not null
    and coalesce(reserva.data_devolucao, reserva.data_evento, reserva.data_festa) is not null
    and daterange(
      coalesce(reserva.data_retirada, reserva.data_evento, reserva.data_festa),
      coalesce(reserva.data_devolucao, reserva.data_evento, reserva.data_festa),
      '[]'
    ) && daterange(p_inicio, p_fim, '[]')
    and (
      exists (
        select 1 from public.reserva_itens item
        where item.reserva_id = reserva.id and item.kit_id = p_kit_id
      )
      or (
        not exists (
          select 1 from public.reserva_itens item
          where item.reserva_id = reserva.id and item.kit_id is not null
        )
        and reserva.kit_id = p_kit_id
      )
    );

  select count(distinct orcamento.id)::integer
  into v_holds_kit
  from public.orcamentos orcamento
  join public.orcamento_itens item
    on item.orcamento_id = orcamento.id and item.kit_id = p_kit_id
  where orcamento.status = 'ACEITA'
    and orcamento.hold_expira_em > now()
    and orcamento.formalizacao_status is distinct from 'RESERVA_CONFIRMADA'
    and (p_orcamento_ignorar is null or orcamento.id <> p_orcamento_ignorar)
    and coalesce(orcamento.data_retirada, orcamento.data_evento) is not null
    and coalesce(orcamento.data_devolucao, orcamento.data_evento) is not null
    and daterange(
      coalesce(orcamento.data_retirada, orcamento.data_evento),
      coalesce(orcamento.data_devolucao, orcamento.data_evento),
      '[]'
    ) && daterange(p_inicio, p_fim, '[]')
    and not exists (
      select 1 from public.reservas reserva_confirmada
      where reserva_confirmada.orcamento_id = orcamento.id
        and reserva_confirmada.status in ('Confirmada', 'Em andamento')
    );

  if v_reservas_kit + v_holds_kit >= v_capacidade then
    return jsonb_build_object(
      'disponivel', false,
      'motivo', 'Todas as unidades deste kit já estão comprometidas ou temporariamente reservadas no período.'
    );
  end if;

  select estoque.codigo || ' - ' || estoque.nome
  into v_conflito
  from public.kit_composicao solicitado
  join public.estoque_itens estoque on estoque.id = solicitado.item_id
  where solicitado.kit_id = p_kit_id
    and (
      solicitado.quantidade
      + coalesce((
          select sum(alocado.quantidade)
          from public.reservas reserva
          join public.reserva_itens item_reserva
            on item_reserva.reserva_id = reserva.id and item_reserva.kit_id is not null
          join public.kit_composicao alocado on alocado.kit_id = item_reserva.kit_id
          where alocado.item_id = solicitado.item_id
            and reserva.status in ('Confirmada', 'Em andamento')
            and (p_reserva_ignorar is null or reserva.id <> p_reserva_ignorar)
            and daterange(
              coalesce(reserva.data_retirada, reserva.data_evento, reserva.data_festa),
              coalesce(reserva.data_devolucao, reserva.data_evento, reserva.data_festa),
              '[]'
            ) && daterange(p_inicio, p_fim, '[]')
        ), 0)
      + coalesce((
          select sum(alocado.quantidade * greatest(coalesce(item_hold.quantidade, 1), 1))
          from public.orcamentos orcamento_hold
          join public.orcamento_itens item_hold
            on item_hold.orcamento_id = orcamento_hold.id and item_hold.kit_id is not null
          join public.kit_composicao alocado on alocado.kit_id = item_hold.kit_id
          where alocado.item_id = solicitado.item_id
            and orcamento_hold.status = 'ACEITA'
            and orcamento_hold.hold_expira_em > now()
            and orcamento_hold.formalizacao_status is distinct from 'RESERVA_CONFIRMADA'
            and (p_orcamento_ignorar is null or orcamento_hold.id <> p_orcamento_ignorar)
            and daterange(
              coalesce(orcamento_hold.data_retirada, orcamento_hold.data_evento),
              coalesce(orcamento_hold.data_devolucao, orcamento_hold.data_evento),
              '[]'
            ) && daterange(p_inicio, p_fim, '[]')
            and not exists (
              select 1 from public.reservas reserva_confirmada
              where reserva_confirmada.orcamento_id = orcamento_hold.id
                and reserva_confirmada.status in ('Confirmada', 'Em andamento')
            )
        ), 0)
    ) > coalesce(estoque.quantidade_disponivel, 0)
  limit 1;

  if v_conflito is not null then
    return jsonb_build_object(
      'disponivel', false,
      'motivo', 'Estoque insuficiente no período para o item ' || v_conflito || '.'
    );
  end if;
  return jsonb_build_object('disponivel', true, 'motivo', 'Kit disponível no período.');
end;
$$;

create or replace function public.verificar_disponibilidade_kit(
  p_kit_id uuid,
  p_inicio date,
  p_fim date,
  p_reserva_ignorar uuid default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.verificar_disponibilidade_kit_com_hold(
    p_kit_id, p_inicio, p_fim, p_reserva_ignorar, null
  );
$$;

create or replace function public.validar_disponibilidade_reserva()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if new.status in ('Confirmada', 'Em andamento') and new.kit_id is not null then
    v_resultado := public.verificar_disponibilidade_kit_com_hold(
      new.kit_id,
      coalesce(new.data_retirada, new.data_evento, new.data_festa),
      coalesce(new.data_devolucao, new.data_evento, new.data_festa),
      new.id,
      new.orcamento_id
    );
    if not coalesce((v_resultado->>'disponivel')::boolean, false) then
      raise exception '%', v_resultado->>'motivo' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validar_confirmacao_reserva_formalizada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_contrato_assinado boolean := false;
  v_sinal_pago boolean := false;
begin
  if new.status = 'Confirmada' and old.status is distinct from 'Confirmada' then
    select * into v_orcamento from public.orcamentos where reserva_id = new.id limit 1;
    if found and (
      v_orcamento.status = 'ACEITA'
      or v_orcamento.formalizacao_status in (
        'DADOS_COMPLETOS','CONTRATO_GERADO','CONTRATO_ENVIADO','AGUARDANDO_ASSINATURA','AGUARDANDO_PAGAMENTO','PRONTA_PARA_CONFIRMAR'
      )
    ) then
      select coalesce(contrato.status = 'Assinado', false) into v_contrato_assinado
      from public.contratos contrato where contrato.id = v_orcamento.contrato_id;
      select coalesce(lancamento.status = 'Pago', false) into v_sinal_pago
      from public.lancamentos_financeiros lancamento where lancamento.id = v_orcamento.lancamento_sinal_id;
      if not coalesce(v_contrato_assinado, false) or not coalesce(v_sinal_pago, false) then
        raise exception using errcode = '23514', message = 'A reserva só pode ser confirmada após contrato assinado e sinal pago.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validar_confirmacao_reserva_formalizada on public.reservas;
create trigger validar_confirmacao_reserva_formalizada
before update of status on public.reservas
for each row execute function public.validar_confirmacao_reserva_formalizada();

create or replace function public.tentar_confirmar_reserva_formalizada(
  p_orcamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_reserva public.reservas%rowtype;
  v_contrato_assinado boolean := false;
  v_sinal_pago boolean := false;
  v_item record;
  v_disponibilidade jsonb;
  v_motivo text;
  v_status text;
begin
  select * into v_orcamento from public.orcamentos where id = p_orcamento_id for update;
  if not found then raise exception using errcode='P0002', message='Proposta não encontrada.'; end if;
  if v_orcamento.reserva_id is null then
    return jsonb_build_object('confirmada',false,'status',v_orcamento.formalizacao_status,'motivo','Reserva provisória ainda não foi criada.');
  end if;
  select * into v_reserva from public.reservas where id=v_orcamento.reserva_id for update;
  if not found then raise exception using errcode='P0002', message='Reserva provisória não encontrada.'; end if;
  select coalesce(contrato.status='Assinado',false) into v_contrato_assinado from public.contratos contrato where contrato.id=v_orcamento.contrato_id;
  select coalesce(lancamento.status='Pago',false) into v_sinal_pago from public.lancamentos_financeiros lancamento where lancamento.id=v_orcamento.lancamento_sinal_id;
  v_contrato_assinado:=coalesce(v_contrato_assinado,false);
  v_sinal_pago:=coalesce(v_sinal_pago,false);
  if not v_contrato_assinado or not v_sinal_pago then
    v_status:=case when not v_contrato_assinado then 'AGUARDANDO_ASSINATURA' else 'AGUARDANDO_PAGAMENTO' end;
    update public.orcamentos set formalizacao_status=v_status,formalizacao_bloqueio=null
    where id=v_orcamento.id and formalizacao_status is distinct from 'RESERVA_CONFIRMADA';
    return jsonb_build_object('confirmada',false,'status',v_status,'contrato_assinado',v_contrato_assinado,'sinal_pago',v_sinal_pago);
  end if;
  update public.orcamentos set formalizacao_status='PRONTA_PARA_CONFIRMAR',formalizacao_bloqueio=null where id=v_orcamento.id;
  for v_item in select distinct item.kit_id from public.orcamento_itens item where item.orcamento_id=v_orcamento.id and item.kit_id is not null
  loop
    v_disponibilidade:=public.verificar_disponibilidade_kit_com_hold(
      v_item.kit_id,
      coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),
      coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
      v_reserva.id,
      v_orcamento.id
    );
    if not coalesce((v_disponibilidade->>'disponivel')::boolean,false) then
      v_motivo:=coalesce(v_disponibilidade->>'motivo','A disponibilidade precisa ser revisada antes da confirmação.');
      update public.orcamentos set formalizacao_bloqueio=v_motivo where id=v_orcamento.id;
      return jsonb_build_object('confirmada',false,'status','PRONTA_PARA_CONFIRMAR','bloqueada',true,'motivo',v_motivo,'contrato_assinado',true,'sinal_pago',true);
    end if;
  end loop;
  update public.reservas set status='Confirmada',status_comercial='Confirmada',status_operacional='Aguardando operação'
  where id=v_reserva.id and status is distinct from 'Confirmada';
  update public.orcamentos set formalizacao_status='RESERVA_CONFIRMADA',formalizacao_bloqueio=null,hold_expira_em=null,formalizado_em=coalesce(formalizado_em,now()) where id=v_orcamento.id;
  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades set etapa='Fechado',motivo_perda=null where id=v_orcamento.oportunidade_id and etapa<>'Perdido';
  end if;
  return jsonb_build_object('confirmada',true,'status','RESERVA_CONFIRMADA','reserva_id',v_reserva.id,'contrato_assinado',true,'sinal_pago',true);
end;
$$;

create or replace function public.formalizar_orcamento_aprovado(
  p_orcamento_id uuid,
  p_valor_sinal numeric,
  p_vencimento date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_reserva_id uuid;
  v_contrato_id uuid;
  v_lancamento_id uuid;
  v_numero_contrato text;
  v_kit_id uuid;
  v_total_kits integer;
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
  select count(*)::integer into v_total_kits from public.orcamento_itens item where item.orcamento_id=p_orcamento_id and item.kit_id is not null;
  if v_total_kits=0 then raise exception 'Adicione ao menos um kit à proposta antes da formalização.'; end if;
  if exists (select 1 from public.orcamento_itens item where item.orcamento_id=p_orcamento_id and item.kit_id is not null and item.quantidade<>1) then
    raise exception 'Cada kit deve ser incluído em uma linha individual da reserva.';
  end if;
  if exists (select 1 from public.orcamento_itens item where item.orcamento_id=p_orcamento_id and item.kit_id is not null group by item.kit_id having count(*)>1) then
    raise exception 'O mesmo kit não pode aparecer em mais de uma linha da proposta.';
  end if;
  for v_linha in select distinct item.kit_id from public.orcamento_itens item where item.orcamento_id=p_orcamento_id and item.kit_id is not null
  loop
    v_disponibilidade:=public.verificar_disponibilidade_kit_com_hold(
      v_linha.kit_id,
      coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),
      coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
      v_orcamento.reserva_id,
      v_orcamento.id
    );
    if not coalesce((v_disponibilidade->>'disponivel')::boolean,false) then
      raise exception '%',coalesce(v_disponibilidade->>'motivo','Um dos kits não está disponível no período informado.');
    end if;
  end loop;
  if v_orcamento.status='ACEITA' and coalesce(v_orcamento.hold_expira_em,'-infinity'::timestamptz)<=now() then
    update public.orcamentos set hold_expira_em=now()+interval '24 hours',formalizacao_bloqueio=null where id=v_orcamento.id;
  end if;
  v_reserva_id:=v_orcamento.reserva_id;
  if v_reserva_id is null then
    select reserva.id into v_reserva_id from public.reservas reserva where reserva.orcamento_id=p_orcamento_id order by reserva.created_at limit 1;
  end if;
  select item.kit_id into v_kit_id from public.orcamento_itens item where item.orcamento_id=p_orcamento_id and item.kit_id is not null order by item.created_at limit 1;
  if v_reserva_id is null then
    insert into public.reservas (
      cliente_id,kit_id,data_evento,horario_evento,endereco_evento,valor_total,valor_sinal,status,observacoes,
      data_retirada,data_devolucao,status_comercial,status_operacional,status_pagamento,orcamento_id
    ) values (
      v_orcamento.cliente_id,v_kit_id,v_orcamento.data_evento,v_orcamento.horario_evento,v_orcamento.endereco_evento,v_orcamento.total,p_valor_sinal,'Pendente',
      concat_ws(E'\n\n','Reserva provisória gerada pela proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.','A confirmação definitiva depende da assinatura do contrato e do pagamento do sinal.',nullif(v_orcamento.observacoes,'')),
      coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
      'Aguardando formalização','Aguardando confirmação','Pendente',p_orcamento_id
    ) returning id into v_reserva_id;
    for v_linha in select * from public.orcamento_itens item where item.orcamento_id=p_orcamento_id order by item.created_at
    loop
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (reserva_id,kit_id,descricao,quantidade,valor_unitario,ordem)
      values (v_reserva_id,v_linha.kit_id,v_linha.descricao,case when v_linha.kit_id is not null then 1 else v_linha.quantidade end,case when v_linha.kit_id is not null then v_linha.subtotal else v_linha.valor_unitario end,v_ordem);
    end loop;
    if coalesce(v_orcamento.desconto,0)>0 then
      v_ordem:=v_ordem+1; insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem) values (v_reserva_id,'Desconto comercial',1,-v_orcamento.desconto,v_ordem);
    end if;
    if coalesce(v_orcamento.acrescimos,0)>0 then
      v_ordem:=v_ordem+1; insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem) values (v_reserva_id,'Acréscimos',1,v_orcamento.acrescimos,v_ordem);
    end if;
    if coalesce(v_orcamento.frete,0)>0 then
      v_ordem:=v_ordem+1; insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem) values (v_reserva_id,'Frete',1,v_orcamento.frete,v_ordem);
    end if;
  else
    update public.reservas set cliente_id=v_orcamento.cliente_id,valor_sinal=p_valor_sinal,status_pagamento=case when status_pagamento in ('Pago','Quitado','Sinal pago') then status_pagamento else 'Pendente' end where id=v_reserva_id;
  end if;
  v_contrato_id:=v_orcamento.contrato_id;
  if v_contrato_id is null then
    select contrato.id into v_contrato_id from public.contratos contrato where contrato.reserva_id=v_reserva_id order by contrato.created_at limit 1;
  end if;
  if v_contrato_id is null then
    v_numero_contrato:='CTR-'||extract(year from (now() at time zone 'America/Sao_Paulo'))::integer::text||'-'||lpad(v_orcamento.numero::text,4,'0');
    insert into public.contratos (reserva_id,numero_contrato,status,observacoes)
    values (v_reserva_id,v_numero_contrato,'Gerado','Contrato gerado automaticamente na formalização da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.') returning id into v_contrato_id;
    insert into public.contrato_versoes (contrato_id,versao,conteudo,status)
    values (v_contrato_id,1,'Contrato gerado automaticamente a partir da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.','Rascunho');
  end if;
  v_lancamento_id:=v_orcamento.lancamento_sinal_id;
  if v_lancamento_id is null then
    select lancamento.id into v_lancamento_id from public.lancamentos_financeiros lancamento
    where lancamento.reserva_id=v_reserva_id and lancamento.categoria='Sinal' and lancamento.status<>'Cancelado' order by lancamento.created_at limit 1;
  end if;
  if v_lancamento_id is null then
    insert into public.lancamentos_financeiros (reserva_id,tipo,descricao,categoria,valor,data_vencimento,status,observacoes)
    values (v_reserva_id,'Receita','Sinal da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0'),'Sinal',p_valor_sinal,p_vencimento,'Pendente','Cobrança criada na formalização comercial V2.') returning id into v_lancamento_id;
  else
    update public.lancamentos_financeiros set valor=p_valor_sinal,data_vencimento=p_vencimento where id=v_lancamento_id and status='Pendente';
  end if;
  select case
    when contrato.status='Assinado' then case when lancamento.status='Pago' then 'PRONTA_PARA_CONFIRMAR' else 'AGUARDANDO_PAGAMENTO' end
    when contrato.email_enviado_em is not null or contrato.status='Enviado' then 'AGUARDANDO_ASSINATURA'
    else 'CONTRATO_GERADO'
  end into v_status_formalizacao
  from public.contratos contrato left join public.lancamentos_financeiros lancamento on lancamento.id=v_lancamento_id where contrato.id=v_contrato_id;
  update public.orcamentos set reserva_id=v_reserva_id,contrato_id=v_contrato_id,lancamento_sinal_id=v_lancamento_id,
    valor_sinal_formalizacao=p_valor_sinal,vencimento_sinal=p_vencimento,formalizacao_status=coalesce(v_status_formalizacao,'CONTRATO_GERADO'),formalizacao_bloqueio=null
  where id=p_orcamento_id;
  return jsonb_build_object('reserva_id',v_reserva_id,'contrato_id',v_contrato_id,'lancamento_sinal_id',v_lancamento_id,'status',coalesce(v_status_formalizacao,'CONTRATO_GERADO'),'mensagem','Reserva provisória, contrato e cobrança do sinal preparados. A reserva será confirmada somente após assinatura e pagamento.');
end;
$$;

create or replace function public.confirmar_assinatura_formalizacao(p_orcamento_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
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
$$;

create or replace function public.confirmar_pagamento_sinal_formalizacao(p_orcamento_id uuid,p_forma_pagamento text)
returns jsonb language plpgsql security definer set search_path=public as $$
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
$$;

create or replace function public.registrar_assinatura_publica_contrato(
  p_token uuid,p_nome text,p_documento text,p_ip_hash text default null,p_user_agent text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_contrato public.contratos%rowtype; v_orcamento public.orcamentos%rowtype;
  v_documento text:=regexp_replace(coalesce(p_documento,''),'\D','','g');
  v_documento_cliente text; v_resultado jsonb; v_agora timestamptz:=now();
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception using errcode='42501', message='Função exclusiva do servidor.'; end if;
  if char_length(trim(coalesce(p_nome,'')))<2 then raise exception 'Informe o nome completo do contratante.'; end if;
  if char_length(v_documento) not in (11,14) then raise exception 'Informe um CPF ou CNPJ válido.'; end if;
  select * into v_contrato from public.contratos where public_token=p_token for update;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  if v_contrato.status='Cancelado' then raise exception 'Este contrato foi cancelado e não aceita assinatura.'; end if;
  select * into v_orcamento from public.orcamentos where contrato_id=v_contrato.id for update;
  if v_contrato.status='Assinado' then
    if found then v_resultado:=public.tentar_confirmar_reserva_formalizada(v_orcamento.id); else v_resultado:=jsonb_build_object('confirmada',false,'status','Assinado'); end if;
    return jsonb_build_object('status',v_resultado->>'status','assinado_em',v_contrato.assinado_em,'ja_assinado',true,'mensagem','Este contrato já foi assinado.') || v_resultado;
  end if;
  select regexp_replace(coalesce(cliente.cpf,''),'\D','','g') into v_documento_cliente
  from public.reservas reserva join public.clientes cliente on cliente.id=reserva.cliente_id where reserva.id=v_contrato.reserva_id;
  if char_length(coalesce(v_documento_cliente,'')) in (11,14) and v_documento_cliente<>v_documento then raise exception 'O CPF ou CNPJ não corresponde ao contratante desta reserva.'; end if;
  update public.contratos set status='Assinado',assinado_em=v_agora,assinado_por=left(trim(p_nome),120),assinatura_documento=v_documento,
    assinatura_ip_hash=nullif(left(trim(coalesce(p_ip_hash,'')),128),''),assinatura_user_agent=nullif(left(trim(coalesce(p_user_agent,'')),500),''),assinatura_aceite=true,
    observacoes=concat_ws(E'\n',observacoes,'Aceite eletrônico registrado em '||to_char(v_agora at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||' por '||left(trim(p_nome),120)||'.')
  where id=v_contrato.id;
  update public.contrato_versoes set status='Assinado' where contrato_id=v_contrato.id;
  if v_orcamento.id is not null then
    update public.orcamentos set contrato_assinado_em=coalesce(contrato_assinado_em,v_agora) where id=v_orcamento.id;
    v_resultado:=public.tentar_confirmar_reserva_formalizada(v_orcamento.id);
  else
    v_resultado:=jsonb_build_object('confirmada',false,'status','Assinado');
  end if;
  return jsonb_build_object('status',v_resultado->>'status','assinado_em',v_agora,'ja_assinado',false,'mensagem',case when coalesce((v_resultado->>'confirmada')::boolean,false) then 'Contrato assinado, pagamento identificado e reserva confirmada.' else 'Contrato assinado. Conclua o pagamento do sinal para confirmar a reserva.' end) || v_resultado;
end;
$$;

create or replace function public.conciliar_pagamento_mercado_pago(
  p_lancamento_id uuid,p_pagamento_id text,p_status text,p_status_detalhe text,p_forma_pagamento text,p_valor numeric,p_pago_em timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_lancamento public.lancamentos_financeiros%rowtype; v_orcamento public.orcamentos%rowtype; v_data_pagamento date;
  v_status_normalizado text:=lower(trim(coalesce(p_status,''))); v_forma text:=coalesce(nullif(trim(p_forma_pagamento),''),'Mercado Pago');
  v_resultado jsonb:='{}'::jsonb; v_agora timestamptz:=coalesce(p_pago_em,now());
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception using errcode='42501', message='Função exclusiva do servidor.'; end if;
  select * into v_lancamento from public.lancamentos_financeiros where id=p_lancamento_id for update;
  if not found or v_lancamento.categoria<>'Sinal' then raise exception 'Cobrança do sinal não encontrada.'; end if;
  if char_length(trim(coalesce(p_pagamento_id,'')))<1 then raise exception 'Pagamento do Mercado Pago inválido.'; end if;
  if v_status_normalizado='approved' and abs(coalesce(p_valor,0)-coalesce(v_lancamento.valor,0))>0.01 then raise exception 'O valor aprovado no Mercado Pago não corresponde ao sinal.'; end if;
  update public.lancamentos_financeiros set provedor_pagamento='Mercado Pago',provedor_pagamento_id=left(trim(p_pagamento_id),180),status_provedor=left(v_status_normalizado,80),status_detalhe_provedor=nullif(left(trim(coalesce(p_status_detalhe,'')),180),''),provedor_atualizado_em=now() where id=v_lancamento.id;
  select * into v_orcamento from public.orcamentos where lancamento_sinal_id=v_lancamento.id for update;
  if v_status_normalizado='approved' then
    v_data_pagamento:=(v_agora at time zone 'America/Sao_Paulo')::date;
    update public.lancamentos_financeiros set status='Pago',data_pagamento=v_data_pagamento,forma_pagamento=v_forma where id=v_lancamento.id;
    insert into public.recebimentos (reserva_id,lancamento_id,valor,data_recebimento,forma_pagamento,status,observacoes)
    values (v_lancamento.reserva_id,v_lancamento.id,v_lancamento.valor,v_data_pagamento,v_forma,'Pago','Sinal conciliado automaticamente pelo Mercado Pago. Pagamento '||trim(p_pagamento_id)||'.')
    on conflict (lancamento_id) where lancamento_id is not null do update set valor=excluded.valor,data_recebimento=excluded.data_recebimento,forma_pagamento=excluded.forma_pagamento,status='Pago',observacoes=excluded.observacoes;
    update public.reservas set valor_sinal=v_lancamento.valor,status_pagamento='Sinal pago',data_pagamento_sinal=v_data_pagamento,forma_pagamento_sinal=v_forma where id=v_lancamento.reserva_id;
    if v_orcamento.id is not null then
      update public.orcamentos set sinal_pago_em=coalesce(sinal_pago_em,v_agora) where id=v_orcamento.id;
      v_resultado:=public.tentar_confirmar_reserva_formalizada(v_orcamento.id);
    end if;
  elsif v_status_normalizado in ('refunded','charged_back') then
    update public.recebimentos set status='Cancelado',observacoes=concat_ws(E'\n',observacoes,'Pagamento estornado pelo Mercado Pago em '||to_char(now() at time zone 'America/Sao_Paulo','DD/MM/YYYY HH24:MI')||'.') where lancamento_id=v_lancamento.id;
    update public.lancamentos_financeiros set status='Pendente',data_pagamento=null,forma_pagamento=null where id=v_lancamento.id;
    update public.reservas set status_pagamento='Pendente',data_pagamento_sinal=null,forma_pagamento_sinal=null,status_comercial=case when status='Confirmada' then 'Pagamento pendente' else status_comercial end where id=v_lancamento.reserva_id;
    if v_orcamento.id is not null then
      update public.orcamentos set sinal_pago_em=null,formalizado_em=null,
        formalizacao_status=case when contrato_assinado_em is not null then 'AGUARDANDO_PAGAMENTO' else 'AGUARDANDO_ASSINATURA' end,
        formalizacao_bloqueio=case when formalizacao_status='RESERVA_CONFIRMADA' then 'Pagamento estornado após a confirmação. Revisão comercial necessária.' else null end
      where id=v_orcamento.id;
    end if;
  end if;
  return jsonb_build_object('lancamento_id',v_lancamento.id,'pagamento_id',trim(p_pagamento_id),'status_provedor',v_status_normalizado,'conciliado',v_status_normalizado='approved') || v_resultado;
end;
$$;

create or replace function public.executar_formalizacao_servidor(
  p_usuario_id uuid,p_orcamento_id uuid,p_acao text,p_valor_sinal numeric default null,p_vencimento date default null,p_forma_pagamento text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_perfil text; v_empresa_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Esta operação só pode ser executada pelo servidor do ERP.'; end if;
  select orcamento.empresa_id into v_empresa_id from public.orcamentos orcamento where orcamento.id=p_orcamento_id;
  if v_empresa_id is null then raise exception 'A proposta ainda não está vinculada a uma empresa.'; end if;
  select vinculo.perfil into v_perfil from public.usuarios_empresa vinculo
  where vinculo.usuario_id=p_usuario_id and vinculo.empresa_id=v_empresa_id and vinculo.ativo=true
  order by case when vinculo.perfil='Administrador' then 0 else 1 end limit 1;
  if v_perfil is null then raise exception 'Usuário sem vínculo ativo com a empresa desta proposta.'; end if;
  if p_acao in ('formalizar','confirmar_assinatura') and v_perfil not in ('Administrador','Comercial') then raise exception 'Seu perfil não possui permissão para formalizar esta venda.'; end if;
  if p_acao='confirmar_sinal' and v_perfil not in ('Administrador','Comercial','Financeiro') then raise exception 'Seu perfil não possui permissão para confirmar o sinal.'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id,'role','authenticated')::text,true);
  if p_acao='formalizar' then return public.formalizar_orcamento_aprovado(p_orcamento_id,p_valor_sinal,p_vencimento);
  elsif p_acao='confirmar_assinatura' then return public.confirmar_assinatura_formalizacao(p_orcamento_id);
  elsif p_acao='confirmar_sinal' then return public.confirmar_pagamento_sinal_formalizacao(p_orcamento_id,p_forma_pagamento);
  end if;
  raise exception 'Ação de formalização inválida.';
end;
$$;

create or replace function public.sincronizar_envio_contrato_formalizacao_v2()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.status='Assinado' then return new; end if;
  if new.email_enviado_em is not null then
    update public.orcamentos set formalizacao_status='AGUARDANDO_ASSINATURA'
    where contrato_id=new.id and formalizacao_status in ('CONTRATO_GERADO','CONTRATO_ENVIADO','AGUARDANDO_ASSINATURA');
  elsif old.email_enviado_em is not null and new.email_enviado_em is null then
    update public.orcamentos set formalizacao_status='CONTRATO_GERADO'
    where contrato_id=new.id and formalizacao_status in ('CONTRATO_ENVIADO','AGUARDANDO_ASSINATURA');
  end if;
  return new;
end;
$$;

drop trigger if exists sincronizar_envio_contrato_formalizacao_v2 on public.contratos;
create trigger sincronizar_envio_contrato_formalizacao_v2
after update of status, email_enviado_em on public.contratos
for each row execute function public.sincronizar_envio_contrato_formalizacao_v2();

revoke all on function public.verificar_disponibilidade_kit_com_hold(uuid,date,date,uuid,uuid) from public,anon,authenticated;
revoke all on function public.tentar_confirmar_reserva_formalizada(uuid) from public,anon,authenticated,service_role;
revoke all on function public.formalizar_orcamento_aprovado(uuid,numeric,date) from public,anon,authenticated,service_role;
revoke all on function public.confirmar_assinatura_formalizacao(uuid) from public,anon,authenticated,service_role;
revoke all on function public.confirmar_pagamento_sinal_formalizacao(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.registrar_assinatura_publica_contrato(uuid,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.registrar_assinatura_publica_contrato(uuid,text,text,text,text) to service_role;
revoke all on function public.conciliar_pagamento_mercado_pago(uuid,text,text,text,text,numeric,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.conciliar_pagamento_mercado_pago(uuid,text,text,text,text,numeric,timestamptz) to service_role;
revoke all on function public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text) from public,anon,authenticated,service_role;
grant execute on function public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text) to service_role;
grant execute on function public.verificar_disponibilidade_kit(uuid,date,date,uuid) to authenticated,service_role;
revoke all on function public.gerenciar_hold_orcamento_v2() from public,anon,authenticated,service_role;
revoke all on function public.validar_confirmacao_reserva_formalizada() from public,anon,authenticated,service_role;
revoke all on function public.sincronizar_envio_contrato_formalizacao_v2() from public,anon,authenticated,service_role;
