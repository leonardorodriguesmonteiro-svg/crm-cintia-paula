-- Sprint Comercial 1.1 - Etapa 5
-- Aceite da proposta sem criar reserva e complemento cadastral posterior.

alter table public.orcamentos
  add column if not exists dados_cliente_completos_em timestamptz,
  add column if not exists versao integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamentos'::regclass
      and conname = 'orcamentos_versao_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_versao_check check (versao > 0) not valid;
  end if;
end $$;

alter table public.orcamentos validate constraint orcamentos_versao_check;

create index if not exists orcamentos_empresa_formalizacao_idx
on public.orcamentos (empresa_id, formalizacao_status, updated_at desc);

create or replace function public.sincronizar_status_formalizacao_orcamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'Aprovado' and new.formalizacao_status is null then
    new.formalizacao_status := 'Aguardando formalização';
  elsif new.status = 'ACEITA' and new.formalizacao_status is null then
    new.formalizacao_status := 'AGUARDANDO_DADOS';
  elsif new.status in ('Recusado', 'Expirado')
    and new.formalizacao_status is not null
    and new.formalizacao_status <> 'Venda confirmada'
  then
    new.formalizacao_status := 'Cancelada';
  elsif new.status in ('RECUSADA', 'EXPIRADA', 'CANCELADA')
    and new.formalizacao_status is distinct from 'RESERVA_CONFIRMADA'
  then
    new.formalizacao_status := 'CANCELADA';
  end if;
  return new;
end;
$$;

create or replace function public.registrar_resposta_publica_orcamento(
  p_token uuid,
  p_decisao text,
  p_nome text,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_oportunidade public.oportunidades%rowtype;
  v_agora timestamptz := now();
  v_nova_jornada boolean := false;
  v_status text;
  v_resposta text;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Funcao exclusiva do servidor.';
  end if;
  if p_decisao not in ('Aprovado', 'Recusado') then
    raise exception using errcode = '22023', message = 'Resposta invalida.';
  end if;
  if char_length(trim(coalesce(p_nome, ''))) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Informe o nome de quem esta respondendo.';
  end if;
  select * into v_orcamento from public.orcamentos where public_token = p_token for update;
  if not found then raise exception using errcode='P0002', message='Proposta nao encontrada.'; end if;
  if v_orcamento.oportunidade_id is not null then
    select * into v_oportunidade from public.oportunidades where id=v_orcamento.oportunidade_id;
    v_nova_jornada := found and v_oportunidade.etapa in ('APROVADA','CONVERTIDA_EM_PROPOSTA');
  end if;
  v_nova_jornada := v_nova_jornada or v_orcamento.status in ('RASCUNHO','ENVIADA','ACEITA','RECUSADA');
  if v_orcamento.status in ('Aprovado','Recusado','ACEITA','RECUSADA') then
    return jsonb_build_object('id',v_orcamento.id,'empresa_id',v_orcamento.empresa_id,'oportunidade_id',v_orcamento.oportunidade_id,'numero',v_orcamento.numero,'status',v_orcamento.status,'decisao',coalesce(v_orcamento.resposta_cliente,v_orcamento.status),'respondido_em',v_orcamento.respondido_em,'ja_respondido',true);
  end if;
  if v_orcamento.status in ('Expirado','EXPIRADA') or (v_orcamento.validade is not null and v_orcamento.validade < (now() at time zone 'America/Sao_Paulo')::date) then
    update public.orcamentos set status=case when v_nova_jornada then 'EXPIRADA' else 'Expirado' end where id=v_orcamento.id;
    raise exception using errcode='23514', message='Esta proposta esta expirada.';
  end if;
  if (v_nova_jornada and v_orcamento.status <> 'ENVIADA') or (not v_nova_jornada and v_orcamento.status not in ('Rascunho','Enviado')) then
    raise exception using errcode='23514', message='Esta proposta nao aceita mais respostas.';
  end if;
  v_status := case when v_nova_jornada and p_decisao='Aprovado' then 'ACEITA' when v_nova_jornada then 'RECUSADA' else p_decisao end;
  v_resposta := case when v_nova_jornada and p_decisao='Aprovado' then 'ACEITA' when v_nova_jornada then 'RECUSADA' else p_decisao end;
  update public.orcamentos set
    status=v_status,
    resposta_cliente=v_resposta,
    respondido_por=left(trim(p_nome),120),
    respondido_em=v_agora,
    resposta_observacao=nullif(left(trim(coalesce(p_observacao,'')),1000),''),
    formalizacao_status=case when v_status='ACEITA' then 'AGUARDANDO_DADOS' when v_status='RECUSADA' then 'CANCELADA' else formalizacao_status end
  where id=v_orcamento.id;
  if not v_nova_jornada and v_orcamento.oportunidade_id is not null then
    update public.oportunidades set etapa=case when p_decisao='Aprovado' then 'Negociação' else 'Perdido' end,
      motivo_perda=case when p_decisao='Recusado' then 'Orçamento recusado pelo cliente.' else null end
    where id=v_orcamento.oportunidade_id and etapa not in ('Fechado','Perdido');
  end if;
  return jsonb_build_object('id',v_orcamento.id,'empresa_id',v_orcamento.empresa_id,'oportunidade_id',v_orcamento.oportunidade_id,'numero',v_orcamento.numero,'status',v_status,'decisao',v_resposta,'respondido_em',v_agora,'ja_respondido',false);
end;
$$;

create or replace function public.completar_dados_cliente_proposta_servidor(
  p_token uuid,
  p_cpf text,
  p_endereco text,
  p_bairro text,
  p_cidade text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_oportunidade public.oportunidades%rowtype;
  v_cliente_id uuid;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then raise exception using errcode='42501', message='Funcao exclusiva do servidor.'; end if;
  if v_cpf !~ '^[0-9]{11}$' or char_length(trim(coalesce(p_endereco,''))) not between 2 and 300 or char_length(trim(coalesce(p_bairro,''))) not between 2 and 120 or char_length(trim(coalesce(p_cidade,''))) not between 2 and 120 then
    raise exception using errcode='22023', message='Dados cadastrais invalidos.';
  end if;
  select * into v_orcamento from public.orcamentos where public_token=p_token for update;
  if not found then raise exception using errcode='P0002', message='Proposta nao encontrada.'; end if;
  if v_orcamento.status <> 'ACEITA' then raise exception using errcode='23514', message='A proposta precisa estar aceita.'; end if;
  if v_orcamento.dados_cliente_completos_em is not null then return jsonb_build_object('orcamento_id',v_orcamento.id,'empresa_id',v_orcamento.empresa_id,'oportunidade_id',v_orcamento.oportunidade_id,'numero',v_orcamento.numero,'status',v_orcamento.formalizacao_status,'ja_completo',true); end if;
  if v_orcamento.oportunidade_id is null then raise exception using errcode='23514', message='Proposta sem pre-reserva vinculada.'; end if;
  select * into v_oportunidade from public.oportunidades where id=v_orcamento.oportunidade_id;
  if not found then raise exception using errcode='P0002', message='Pre-reserva nao encontrada.'; end if;
  select cliente.id into v_cliente_id from public.clientes cliente where regexp_replace(coalesce(cliente.cpf,''),'[^0-9]','','g')=v_cpf order by cliente.created_at limit 1;
  v_cliente_id := coalesce(v_cliente_id,v_orcamento.cliente_id,v_oportunidade.cliente_id);
  if v_cliente_id is null then
    select cliente.id into v_cliente_id from public.clientes cliente where regexp_replace(coalesce(cliente.whatsapp,''),'[^0-9]','','g')=regexp_replace(coalesce(v_oportunidade.celular,''),'[^0-9]','','g') order by cliente.created_at limit 1;
  end if;
  if v_cliente_id is null then
    insert into public.clientes (nome,cpf,whatsapp,email,endereco,bairro,cidade,origem,status,observacoes)
    values (v_oportunidade.nome_contato,v_cpf,v_oportunidade.celular,coalesce(v_email,v_oportunidade.email),trim(p_endereco),trim(p_bairro),trim(p_cidade),v_oportunidade.origem,'Cliente','Cadastro completado após o aceite da proposta.') returning id into v_cliente_id;
  else
    update public.clientes set cpf=v_cpf, whatsapp=coalesce(nullif(whatsapp,''),v_oportunidade.celular), email=coalesce(v_email,email,v_oportunidade.email), endereco=trim(p_endereco), bairro=trim(p_bairro), cidade=trim(p_cidade), updated_at=now() where id=v_cliente_id;
  end if;
  update public.oportunidades set cliente_id=v_cliente_id where id=v_oportunidade.id;
  update public.orcamentos set cliente_id=v_cliente_id,dados_cliente_completos_em=now(),formalizacao_status='DADOS_COMPLETOS' where id=v_orcamento.id;
  return jsonb_build_object('orcamento_id',v_orcamento.id,'empresa_id',v_orcamento.empresa_id,'oportunidade_id',v_orcamento.oportunidade_id,'numero',v_orcamento.numero,'status','DADOS_COMPLETOS','ja_completo',false);
end;
$$;

create or replace function public.enviar_proposta_servidor(p_usuario_id uuid,p_empresa_id uuid,p_orcamento_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_orcamento public.orcamentos%rowtype; v_oportunidade public.oportunidades%rowtype;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception using errcode='42501', message='Funcao exclusiva do servidor.'; end if;
  if not exists (select 1 from public.usuarios_empresa vinculo where vinculo.usuario_id=p_usuario_id and vinculo.empresa_id=p_empresa_id and vinculo.ativo=true and vinculo.perfil in ('Administrador','Comercial')) then raise exception using errcode='42501', message='Usuario sem permissao comercial.'; end if;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id and empresa_id=p_empresa_id for update;
  if not found then raise exception using errcode='P0002', message='Proposta nao encontrada.'; end if;
  if v_orcamento.status='ENVIADA' then return jsonb_build_object('id',v_orcamento.id,'numero',v_orcamento.numero,'oportunidade_id',v_orcamento.oportunidade_id,'status',v_orcamento.status,'ja_enviada',true); end if;
  if v_orcamento.status <> 'RASCUNHO' then raise exception using errcode='23514', message='Somente uma proposta em rascunho pode ser enviada.'; end if;
  if v_orcamento.oportunidade_id is null then raise exception using errcode='23514', message='Proposta sem pre-reserva vinculada.'; end if;
  select * into v_oportunidade from public.oportunidades where id=v_orcamento.oportunidade_id and empresa_id=p_empresa_id for update;
  if not found or v_oportunidade.etapa <> 'APROVADA' then raise exception using errcode='23514', message='A pre-reserva precisa estar aprovada.'; end if;
  perform set_config('app.usuario_id',p_usuario_id::text,true);
  update public.orcamentos set status='ENVIADA',versao=versao+1 where id=v_orcamento.id;
  update public.oportunidades set etapa='CONVERTIDA_EM_PROPOSTA',versao=versao+1 where id=v_oportunidade.id;
  return jsonb_build_object('id',v_orcamento.id,'numero',v_orcamento.numero,'oportunidade_id',v_orcamento.oportunidade_id,'status','ENVIADA','ja_enviada',false);
end;
$$;

revoke all on function public.registrar_resposta_publica_orcamento(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.registrar_resposta_publica_orcamento(uuid,text,text,text) to service_role;
revoke all on function public.completar_dados_cliente_proposta_servidor(uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.completar_dados_cliente_proposta_servidor(uuid,text,text,text,text,text) to service_role;
revoke all on function public.enviar_proposta_servidor(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.enviar_proposta_servidor(uuid,uuid,uuid) to service_role;
revoke all on function public.sincronizar_status_formalizacao_orcamento() from public,anon,authenticated,service_role;
