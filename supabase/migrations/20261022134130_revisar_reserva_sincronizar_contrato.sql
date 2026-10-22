alter table public.reservas add column if not exists revisao integer not null default 1;
alter table public.contratos add column if not exists snapshot_contratual jsonb;
alter table public.contratos add column if not exists cancelado_em timestamptz;
alter table public.contratos add column if not exists motivo_cancelamento text;
alter table public.contratos add column if not exists notificacao_cancelamento_em timestamptz;
alter table public.contratos add column if not exists notificacao_cancelamento_erro text;
alter table public.contratos add column if not exists notificacao_cancelamento_inicio timestamptz;
drop index if exists public.contratos_reserva_unique;
create unique index contratos_reserva_unique on public.contratos(reserva_id) where reserva_id is not null and status is distinct from 'Cancelado';

create or replace function public.snapshot_contrato_reserva(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('reserva',to_jsonb(r),'cliente',to_jsonb(c),'itens',coalesce((select jsonb_agg(to_jsonb(i) order by i.ordem,i.id) from public.reserva_itens i where i.reserva_id=r.id),'[]'::jsonb))
 from public.reservas r left join public.clientes c on c.id=r.cliente_id where r.id=p_id;
$$;
revoke all on function public.snapshot_contrato_reserva(uuid) from public,anon,authenticated;
grant execute on function public.snapshot_contrato_reserva(uuid) to service_role,authenticated;
create or replace function public.congelar_snapshot_contrato() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.snapshot_contratual is null then new.snapshot_contratual:=public.snapshot_contrato_reserva(new.reserva_id); end if;
 return new;
end; $$;
revoke all on function public.congelar_snapshot_contrato() from public,anon,authenticated;
create trigger congelar_snapshot_contrato before insert on public.contratos for each row execute function public.congelar_snapshot_contrato();
-- Documentos existentes ganham uma fotografia; divergências anteriores são reparadas explicitamente.
update public.contratos set snapshot_contratual=public.snapshot_contrato_reserva(reserva_id) where snapshot_contratual is null;

create or replace function public.revisar_reserva_servidor(p_empresa_id uuid,p_usuario_id uuid,p_reserva_id uuid,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<revisar_reserva_servidor>>
declare
 r public.reservas%rowtype; q public.orcamentos%rowtype; l public.lancamentos_financeiros%rowtype;
 itens jsonb; anteriores jsonb; item record; total numeric; desconto numeric; subtotal numeric;
 data_evento date; horario text; endereco text; cliente uuid; sinal numeric; cancelado uuid; alterado boolean;
begin
 if not exists(select 1 from public.usuarios_empresa where empresa_id=p_empresa_id and usuario_id=p_usuario_id and ativo and perfil in ('Administrador','Comercial')) then raise exception 'Sem permissão para editar a reserva.' using errcode='42501'; end if;
 -- A mesma ordem de bloqueio usada pela formalização evita corrida com assinatura/pagamento.
 select * into q from public.orcamentos where reserva_id=p_reserva_id and empresa_id=p_empresa_id for update;
 if not found then raise exception 'Orçamento vinculado não encontrado.' using errcode='P0002'; end if;
 select * into r from public.reservas where id=p_reserva_id and orcamento_id=q.id for update;
 if not found then raise exception 'Reserva não encontrada.' using errcode='P0002'; end if;
 if (p_dados->>'revisao')::integer is distinct from r.revisao then raise exception 'A reserva foi alterada. Atualize a página antes de salvar.' using errcode='40001'; end if;
 if r.status in ('Cancelada','Concluída','Em andamento') then raise exception 'Esta reserva não permite revisão contratual nesta etapa.' using errcode='22023'; end if;
 data_evento:=coalesce((p_dados->>'data_evento')::date,r.data_evento);
 horario:=case when p_dados ? 'horario_evento' then nullif(trim(p_dados->>'horario_evento'),'') else r.horario_evento end;
 endereco:=case when p_dados ? 'endereco_evento' then nullif(trim(p_dados->>'endereco_evento'),'') else r.endereco_evento end;
 cliente:=coalesce((p_dados->>'cliente_id')::uuid,r.cliente_id);
 if cliente is distinct from r.cliente_id then raise exception 'A troca de cliente exige uma nova solicitação.' using errcode='22023'; end if;
 sinal:=coalesce((p_dados->>'valor_sinal')::numeric,r.valor_sinal,0);
 select coalesce(jsonb_agg(jsonb_build_object('kit_id',i.kit_id,'estoque_item_id',i.estoque_item_id,'kit_composicao_id',i.kit_composicao_id,'descricao',i.descricao,'quantidade',i.quantidade,'valor_unitario',i.valor_unitario) order by i.ordem,i.created_at,i.id),'[]'::jsonb) into anteriores from public.reserva_itens i where i.reserva_id=r.id;
 itens:=coalesce(p_dados->'itens',anteriores);
 if jsonb_typeof(itens)<>'array' or jsonb_array_length(itens) not between 1 and 100 then raise exception 'Informe de 1 a 100 itens.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_to_recordset(itens) x(descricao text,quantidade numeric,valor_unitario numeric,kit_id uuid,estoque_item_id uuid) where length(trim(coalesce(x.descricao,''))) not between 2 and 300 or x.quantidade is null or x.quantidade<=0 or x.quantidade<>round(x.quantidade,2) or x.valor_unitario is null or x.valor_unitario<>round(x.valor_unitario,2) or (x.kit_id is not null and (x.quantidade<>1 or x.estoque_item_id is not null)) or (x.valor_unitario<0 and (x.kit_id is not null or x.estoque_item_id is not null))) then raise exception 'Itens ou valores inválidos.' using errcode='22023'; end if;
 -- Normalização torna salvar sem alterações idempotente, independentemente da representação numérica.
 select jsonb_agg(jsonb_build_object('kit_id',x.kit_id,'estoque_item_id',x.estoque_item_id,'kit_composicao_id',x.kit_composicao_id,'descricao',trim(x.descricao),'quantidade',x.quantidade,'valor_unitario',x.valor_unitario)) into itens from jsonb_to_recordset(itens) x(kit_id uuid,estoque_item_id uuid,kit_composicao_id uuid,descricao text,quantidade numeric,valor_unitario numeric);
 select sum(round(x.quantidade*x.valor_unitario,2)),sum(greatest(round(x.quantidade*x.valor_unitario,2),0)),sum(greatest(-round(x.quantidade*x.valor_unitario,2),0)) into total,subtotal,desconto from jsonb_to_recordset(itens) x(quantidade numeric,valor_unitario numeric);
 if total<=0 or sinal<0 or sinal>total then raise exception 'Confira o total e o valor do sinal.' using errcode='22023'; end if;
 select * into l from public.lancamentos_financeiros where id=q.lancamento_sinal_id for update;
 if l.status='Pago' and sinal is distinct from l.valor then raise exception 'O sinal já recebido deve ser preservado. Ajustes financeiros são realizados no Financeiro.' using errcode='22023'; end if;
 alterado:=data_evento is distinct from r.data_evento or horario is distinct from r.horario_evento or endereco is distinct from r.endereco_evento or sinal is distinct from r.valor_sinal or itens<>anteriores or q.data_evento is distinct from data_evento or q.total is distinct from total;
 if not alterado then
 update public.reservas set observacoes=case when p_dados ? 'observacoes' then p_dados->>'observacoes' else r.observacoes end where id=r.id;
 return jsonb_build_object('alterado',false,'reserva_id',r.id,'revisao',r.revisao); end if;
 perform set_config('app.revisao_reserva',r.id::text,true);
 perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 perform set_config('app.usuario_id',p_usuario_id::text,true);
 cancelado:=q.contrato_id;
 if cancelado is not null then
  update public.contratos set status='Cancelado',cancelado_em=now(),motivo_cancelamento='Reserva revisada: a versão anterior foi substituída e não deve ser utilizada.' where id=cancelado and status<>'Cancelado';
 end if;
 update public.orcamentos set contrato_id=null,contrato_assinado_em=null,formalizado_em=null,formalizacao_status='DADOS_COMPLETOS',formalizacao_bloqueio=null,hold_expira_em=null where id=q.id;
 update public.reservas set status='Pendente',status_comercial='Aguardando contrato',status_operacional='Aguardando confirmação',data_evento=revisar_reserva_servidor.data_evento,
 data_retirada=case when r.data_retirada is null or r.data_retirada=r.data_evento then revisar_reserva_servidor.data_evento else r.data_retirada end,
 data_devolucao=case when r.data_devolucao is null or r.data_devolucao=r.data_evento then revisar_reserva_servidor.data_evento else r.data_devolucao end,
 horario_evento=horario,endereco_evento=endereco,valor_sinal=sinal,revisao=r.revisao+1,
 observacoes=case when p_dados ? 'observacoes' then p_dados->>'observacoes' else r.observacoes end where id=r.id;
 delete from public.reserva_itens where reserva_id=r.id;
 insert into public.reserva_itens(reserva_id,kit_id,estoque_item_id,kit_composicao_id,descricao,quantidade,valor_unitario,ordem)
 select r.id,x.kit_id,x.estoque_item_id,x.kit_composicao_id,x.descricao,x.quantidade,x.valor_unitario,(row_number() over())::integer from jsonb_to_recordset(itens) x(kit_id uuid,estoque_item_id uuid,kit_composicao_id uuid,descricao text,quantidade numeric,valor_unitario numeric);
 update public.reservas set valor_total=total,kit_id=(select i.kit_id from public.reserva_itens i where i.reserva_id=r.id and i.kit_id is not null order by i.ordem limit 1) where id=r.id;
 delete from public.orcamento_taxas where orcamento_id=q.id;
 delete from public.orcamento_itens where orcamento_id=q.id;
 insert into public.orcamento_itens(orcamento_id,kit_id,estoque_item_id,tipo_origem,descricao,quantidade,valor_unitario,preco_base,preco_unitario_orcamento,ordem)
 select q.id,i.kit_id,i.estoque_item_id,case when i.kit_id is not null then 'KIT' when i.estoque_item_id is not null then 'ESTOQUE' else 'LIVRE' end,i.descricao,i.quantidade,i.valor_unitario,i.valor_unitario,i.valor_unitario,i.ordem from public.reserva_itens i where i.reserva_id=r.id and i.valor_unitario>=0;
 update public.orcamentos set data_evento=revisar_reserva_servidor.data_evento,data_retirada=nr.data_retirada,data_devolucao=nr.data_devolucao,horario_evento=horario,endereco_evento=endereco,subtotal=revisar_reserva_servidor.subtotal,desconto_tipo='VALOR',desconto_valor=revisar_reserva_servidor.desconto,acrescimos=0,frete=0,total_taxas=0,versao=q.versao+1,valor_sinal_formalizacao=nullif(sinal,0) from public.reservas nr where public.orcamentos.id=q.id and nr.id=r.id;
 update public.oportunidades set data_evento=revisar_reserva_servidor.data_evento,valor_estimado=total,updated_at=now(),versao=versao+1 where id=q.oportunidade_id and empresa_id=p_empresa_id;
 insert into public.reserva_timeline(reserva_id,titulo,descricao,tipo) values(r.id,'Reserva revisada','Datas e valores sincronizados. Contrato anterior substituído; nova assinatura necessária. Pagamentos preservados.','Contrato');
 return jsonb_build_object('alterado',true,'reserva_id',r.id,'revisao',r.revisao+1,'contrato_cancelado_id',cancelado,'sinal_pago_preservado',l.status='Pago');
end; $$;
revoke all on function public.revisar_reserva_servidor(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.revisar_reserva_servidor(uuid,uuid,uuid,jsonb) to service_role;

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
  if exists(select 1 from public.lancamentos_financeiros where id=v_orcamento.lancamento_sinal_id and status='Pago' and valor<>p_valor_sinal) then raise exception 'Preserve o valor do sinal já recebido.'; end if;
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
    where contrato.reserva_id=v_reserva_id and contrato.status is distinct from 'Cancelado'
    order by contrato.created_at limit 1;
  end if;
  if v_contrato_id is null then
    v_numero_contrato:='CTR-'||extract(year from (now() at time zone 'America/Sao_Paulo'))::integer::text||'-'||lpad(v_orcamento.numero::text,4,'0')||case when exists(select 1 from public.contratos where reserva_id=v_reserva_id) then '-R'||(select (count(*)+1)::text from public.contratos where reserva_id=v_reserva_id) else '' end;
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



-- Bloqueia o caminho antigo que alterava silenciosamente um contrato já emitido.
create or replace function public.proteger_reserva_contratada() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if tg_table_name='reservas' then v_id:=old.id; elsif tg_op='INSERT' then v_id:=new.reserva_id; else v_id:=old.reserva_id; end if;
 if current_setting('app.revisao_reserva',true) is not distinct from v_id::text then return case when tg_op='DELETE' then old else new end; end if;
 if tg_table_name='reservas' then
 if row(new.data_evento,new.horario_evento,new.endereco_evento,new.cliente_id,new.valor_sinal,new.valor_total,new.data_retirada,new.data_devolucao,new.horario_retirada) is not distinct from row(old.data_evento,old.horario_evento,old.endereco_evento,old.cliente_id,old.valor_sinal,old.valor_total,old.data_retirada,old.data_devolucao,old.horario_retirada) then return new; end if;
 end if;
 if exists(select 1 from public.contratos where reserva_id=v_id and status in ('Gerado','Enviado','Assinado')) then
  raise exception 'Use a edição de reserva para revisar o contrato e avisar o cliente.' using errcode='23514';
 end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function public.proteger_reserva_contratada() from public,anon,authenticated;
create trigger proteger_reserva_contratada before update on public.reservas for each row execute function public.proteger_reserva_contratada();
create trigger proteger_itens_contratados before insert or update or delete on public.reserva_itens for each row execute function public.proteger_reserva_contratada();
