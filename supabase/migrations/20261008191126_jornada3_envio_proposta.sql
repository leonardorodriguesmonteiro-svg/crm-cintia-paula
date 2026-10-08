-- Bridges finalized Jornada 3 budgets to the existing public proposal lifecycle.
-- Sending exposes a proposal; it does not reserve inventory or send an email.
alter table public.orcamentos add column if not exists status_antes_envio text;

create or replace function public.enviar_proposta_servidor(p_usuario_id uuid, p_empresa_id uuid, p_orcamento_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_oportunidade public.oportunidades%rowtype;
begin
  if not exists (select 1 from public.usuarios_empresa where usuario_id=p_usuario_id and empresa_id=p_empresa_id and ativo and perfil in ('Administrador','Comercial')) then
    raise exception using errcode='42501', message='Usuário sem permissão comercial.';
  end if;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id and empresa_id=p_empresa_id for update;
  if not found then raise exception using errcode='P0002', message='Proposta não encontrada.'; end if;
  if v_orcamento.resposta_cliente is not null or v_orcamento.reserva_id is not null then
    raise exception using errcode='23514', message='Uma proposta respondida ou vinculada a reserva não pode ser enviada.';
  end if;
  if v_orcamento.validade is not null and v_orcamento.validade < (now() at time zone 'America/Sao_Paulo')::date then
    raise exception using errcode='23514', message='Esta proposta está expirada. Revise a validade antes de enviar.';
  end if;
  if v_orcamento.status = 'ENVIADA' then
    return jsonb_build_object('id',v_orcamento.id,'numero',v_orcamento.numero,'oportunidade_id',v_orcamento.oportunidade_id,'status','ENVIADA','public_token',v_orcamento.public_token,'ja_enviada',true);
  end if;
  if v_orcamento.status not in ('RASCUNHO','FINALIZADO') then
    raise exception using errcode='23514', message='Finalize o orçamento antes de enviar a proposta.';
  end if;
  if not exists (select 1 from public.orcamento_itens where orcamento_id=v_orcamento.id) then
    raise exception using errcode='23514', message='Adicione pelo menos um item antes de enviar.';
  end if;
  if v_orcamento.status='FINALIZADO' and (length(trim(coalesce(v_orcamento.contato_nome,'')))<2 or length(regexp_replace(coalesce(v_orcamento.contato_telefone,''),'\D','','g')) not between 10 and 11 or v_orcamento.data_evento is null) then
    raise exception using errcode='23514', message='Confira nome, telefone e data do orçamento.';
  end if;
  if v_orcamento.oportunidade_id is not null then
    select * into v_oportunidade from public.oportunidades where id=v_orcamento.oportunidade_id and empresa_id=p_empresa_id for update;
    if not found or v_oportunidade.etapa not in ('APROVADA','CONVERTIDA_EM_PROPOSTA') then
      raise exception using errcode='23514', message='A solicitação precisa estar aprovada.';
    end if;
  elsif v_orcamento.status='RASCUNHO' then
    raise exception using errcode='23514', message='Finalize este orçamento direto antes de enviar.';
  end if;
  perform set_config('app.usuario_id',p_usuario_id::text,true);
  perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  update public.orcamentos set status_antes_envio=status, status='ENVIADA',public_token=coalesce(public_token,gen_random_uuid()),versao=versao+1 where id=v_orcamento.id returning * into v_orcamento;
  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades set etapa='CONVERTIDA_EM_PROPOSTA',versao=versao+1 where id=v_orcamento.oportunidade_id and etapa='APROVADA';
  end if;
  return jsonb_build_object('id',v_orcamento.id,'numero',v_orcamento.numero,'oportunidade_id',v_orcamento.oportunidade_id,'status','ENVIADA','public_token',v_orcamento.public_token,'ja_enviada',false);
end;
$$;

create or replace function public.cancelar_envio_proposta_servidor(p_usuario_id uuid, p_empresa_id uuid, p_orcamento_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_orcamento public.orcamentos%rowtype; v_status text;
begin
  if not exists (select 1 from public.usuarios_empresa where usuario_id=p_usuario_id and empresa_id=p_empresa_id and ativo and perfil in ('Administrador','Comercial')) then
    raise exception using errcode='42501', message='Usuário sem permissão comercial.';
  end if;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id and empresa_id=p_empresa_id for update;
  if not found then raise exception using errcode='P0002', message='Proposta não encontrada.'; end if;
  if v_orcamento.resposta_cliente is not null or v_orcamento.reserva_id is not null or v_orcamento.status not in ('Enviado','ENVIADA') then
    raise exception using errcode='23514', message='Somente uma proposta enviada e sem resposta pode ter o envio cancelado.';
  end if;
  v_status := case when v_orcamento.status_antes_envio='FINALIZADO' then 'EM_EDICAO' when v_orcamento.status='ENVIADA' then 'RASCUNHO' else 'Rascunho' end;
  perform set_config('app.usuario_id',p_usuario_id::text,true);
  perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  update public.orcamentos set public_token=gen_random_uuid(),status=v_status,email_enviado_em=null,email_destino=null,email_erro=null,versao=versao+1 where id=v_orcamento.id;
  update public.oportunidades set etapa='APROVADA',versao=versao+1 where id=v_orcamento.oportunidade_id and empresa_id=p_empresa_id and etapa='CONVERTIDA_EM_PROPOSTA';
  return jsonb_build_object('id',v_orcamento.id,'numero',v_orcamento.numero,'destino_anterior',v_orcamento.email_destino,'status',v_status);
end;
$$;
revoke all on function public.enviar_proposta_servidor(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.enviar_proposta_servidor(uuid,uuid,uuid) to service_role;
revoke all on function public.cancelar_envio_proposta_servidor(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancelar_envio_proposta_servidor(uuid,uuid,uuid) to service_role;

-- Direct quotes must also support the existing post-acceptance registration form.
CREATE OR REPLACE FUNCTION public.completar_dados_cliente_proposta_v2_servidor(p_token uuid, p_cpf text, p_cep text, p_endereco text, p_numero text, p_complemento text, p_bairro text, p_cidade text, p_estado text, p_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_orcamento public.orcamentos%rowtype;
  v_oportunidade public.oportunidades%rowtype;
  v_cliente_id uuid;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_cep text := regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g');
  v_endereco text := trim(coalesce(p_endereco, ''));
  v_numero text := trim(coalesce(p_numero, ''));
  v_complemento text := nullif(trim(coalesce(p_complemento, '')), '');
  v_bairro text := trim(coalesce(p_bairro, ''));
  v_cidade text := trim(coalesce(p_cidade, ''));
  v_estado text := upper(trim(coalesce(p_estado, '')));
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if v_cpf !~ '^[0-9]{11}([0-9]{3})?$' then raise exception using errcode='22023', message='CPF ou CNPJ invalido.'; end if;
  if v_cep !~ '^[0-9]{8}$' then raise exception using errcode='22023', message='CEP invalido.'; end if;
  if char_length(v_endereco) not between 2 and 300 then raise exception using errcode='22023', message='Logradouro invalido.'; end if;
  if char_length(v_numero) not between 1 and 30 then raise exception using errcode='22023', message='Numero do endereco invalido.'; end if;
  if v_complemento is not null and char_length(v_complemento) > 120 then raise exception using errcode='22023', message='Complemento muito longo.'; end if;
  if char_length(v_bairro) not between 2 and 120 then raise exception using errcode='22023', message='Bairro invalido.'; end if;
  if char_length(v_cidade) not between 2 and 120 then raise exception using errcode='22023', message='Cidade invalida.'; end if;
  if v_estado not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then raise exception using errcode='22023', message='UF invalida.'; end if;
  if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception using errcode='22023', message='E-mail obrigatorio e invalido.'; end if;
  select * into v_orcamento from public.orcamentos where public_token=p_token for update;
  if not found then raise exception using errcode='P0002', message='Proposta nao encontrada.'; end if;
  if v_orcamento.status <> 'ACEITA' then raise exception using errcode='23514', message='A proposta precisa estar aceita.'; end if;
  if v_orcamento.dados_cliente_completos_em is not null then return jsonb_build_object('orcamento_id',v_orcamento.id,'empresa_id',v_orcamento.empresa_id,'oportunidade_id',v_orcamento.oportunidade_id,'numero',v_orcamento.numero,'status',v_orcamento.formalizacao_status,'ja_completo',true); end if;
  if v_orcamento.oportunidade_id is null then
    v_oportunidade.nome_contato := v_orcamento.contato_nome;
    v_oportunidade.celular := v_orcamento.contato_telefone;
    v_oportunidade.email := v_orcamento.contato_email;
    v_oportunidade.origem := v_orcamento.origem;
  else
    select * into v_oportunidade from public.oportunidades where id=v_orcamento.oportunidade_id and empresa_id=v_orcamento.empresa_id;
    if not found then raise exception using errcode='P0002', message='Pre-reserva nao encontrada.'; end if;
  end if;
  select cliente.id into v_cliente_id from public.clientes cliente where regexp_replace(coalesce(cliente.cpf,''),'[^0-9]','','g')=v_cpf and (v_orcamento.oportunidade_id is not null or cliente.id=v_orcamento.cliente_id) order by cliente.created_at limit 1;
  v_cliente_id:=coalesce(v_cliente_id,v_orcamento.cliente_id,v_oportunidade.cliente_id);
  if v_cliente_id is null and v_orcamento.oportunidade_id is not null then select cliente.id into v_cliente_id from public.clientes cliente where regexp_replace(coalesce(cliente.whatsapp,''),'[^0-9]','','g')=regexp_replace(coalesce(v_oportunidade.celular,''),'[^0-9]','','g') order by cliente.created_at limit 1; end if;
  if v_cliente_id is null then
    insert into public.clientes (nome,cpf,whatsapp,email,cep,endereco,numero,complemento,bairro,cidade,estado,origem,status,observacoes)
    values (v_oportunidade.nome_contato,v_cpf,v_oportunidade.celular,v_email,v_cep,v_endereco,v_numero,v_complemento,v_bairro,v_cidade,v_estado,v_oportunidade.origem,'Cliente','Cadastro completado após o aceite da proposta.') returning id into v_cliente_id;
  else
    update public.clientes set cpf=v_cpf,whatsapp=coalesce(nullif(whatsapp,''),v_oportunidade.celular),email=v_email,cep=v_cep,endereco=v_endereco,numero=v_numero,complemento=v_complemento,bairro=v_bairro,cidade=v_cidade,estado=v_estado,updated_at=now() where id=v_cliente_id;
  end if;
  update public.oportunidades set cliente_id=v_cliente_id,email=v_email where id=v_oportunidade.id;
  update public.orcamentos set cliente_id=v_cliente_id,dados_cliente_completos_em=now(),formalizacao_status='DADOS_COMPLETOS' where id=v_orcamento.id;
  return jsonb_build_object('orcamento_id',v_orcamento.id,'empresa_id',v_orcamento.empresa_id,'oportunidade_id',v_orcamento.oportunidade_id,'numero',v_orcamento.numero,'status','DADOS_COMPLETOS','ja_completo',false);
end;
$function$;
revoke all on function public.completar_dados_cliente_proposta_v2_servidor(uuid,text,text,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.completar_dados_cliente_proposta_v2_servidor(uuid,text,text,text,text,text,text,text,text,text) to service_role;
