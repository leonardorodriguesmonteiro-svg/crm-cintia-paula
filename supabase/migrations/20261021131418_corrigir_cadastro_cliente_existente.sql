-- Corrige reenvio de cadastro de cliente existente sem substituir seus dados.
create or replace function public.completar_cadastro_pre_reserva(p_empresa_id uuid,p_token_hash text,p_dados jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_cliente uuid; v_pedido public.oportunidades%rowtype; v_documento text; v_telefone text; v_encontrados uuid[];
begin
 select oportunidade_id into v_id from public.acompanhamento_links
 where token_hash=p_token_hash and revoked_at is null and expires_at>now() for update;
 if v_id is null then raise exception 'Link inválido ou expirado.' using errcode='22023'; end if;
 select * into v_pedido from public.oportunidades where id=v_id and empresa_id=p_empresa_id for update;
 if not found then raise exception 'Pedido não encontrado.' using errcode='22023'; end if;
 if v_pedido.cadastro_completo_em is not null then return jsonb_build_object('sucesso',true,'ja_completo',true); end if;
 if v_pedido.etapa not in ('APROVADA','CONVERTIDA_EM_PROPOSTA') or exists(select 1 from public.orcamentos where oportunidade_id=v_id and status<>'RASCUNHO') then
  raise exception 'O cadastro não está disponível nesta etapa. Fale com a equipe.' using errcode='22023';
 end if;
 if coalesce(p_dados->>'cpf','') !~ '^([0-9]{11}|[0-9]{14})$' or coalesce(p_dados->>'cep','') !~ '^[0-9]{8}$'
 or length(coalesce(p_dados->>'endereco','')) not between 2 and 300
 or length(coalesce(p_dados->>'numero','')) not between 1 and 30
 or length(coalesce(p_dados->>'bairro','')) not between 2 and 120
 or length(coalesce(p_dados->>'cidade','')) not between 2 and 120
 or coalesce(p_dados->>'estado','') !~ '^[A-Z]{2}$'
 or coalesce(p_dados->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
  raise exception 'Dados cadastrais inválidos.' using errcode='22023';
 end if;
 -- Reuse only when BOTH document and order contact identify the same customer.
 -- A document or phone alone must never update an unrelated customer.
 v_documento := p_dados->>'cpf';
 v_telefone := regexp_replace(coalesce(v_pedido.celular,''),'[^0-9]','','g');
 perform pg_advisory_xact_lock(hashtextextended('cadastro-documento:'||v_documento,0));
 perform pg_advisory_xact_lock(hashtextextended('cadastro-telefone:'||v_telefone,0));
 select array_agg(id) into v_encontrados from public.clientes
 where regexp_replace(coalesce(case when length(v_documento)=11 then cpf else cnpj end,''),'[^0-9]','','g')=v_documento
   and regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g')=v_telefone;
 if cardinality(v_encontrados)>1 then
   raise exception 'Não foi possível confirmar o cadastro existente. Peça à equipe para revisar o vínculo do cliente.' using errcode='22023';
 end if;
 v_cliente := v_encontrados[1];
 if v_pedido.cliente_id is not null and v_cliente is distinct from v_pedido.cliente_id then
   raise exception 'Os dados não correspondem ao cliente vinculado ao pedido. Peça à equipe para revisar o cadastro.' using errcode='22023';
 end if;
 if v_cliente is not null then
   -- Fill missing information only; retain established customer identity and data.
   update public.clientes set
     email=coalesce(nullif(trim(email),''),p_dados->>'email'),
     cep=coalesce(nullif(trim(cep),''),p_dados->>'cep'),
     endereco=coalesce(nullif(trim(endereco),''),p_dados->>'endereco'),
     numero=coalesce(nullif(trim(numero),''),p_dados->>'numero'),
     complemento=coalesce(nullif(trim(complemento),''),nullif(p_dados->>'complemento','')),
     bairro=coalesce(nullif(trim(bairro),''),p_dados->>'bairro'),
     cidade=coalesce(nullif(trim(cidade),''),p_dados->>'cidade'),
     estado=coalesce(nullif(trim(estado),''),p_dados->>'estado')
   where id=v_cliente;
 else
   if exists(select 1 from public.clientes
     where regexp_replace(coalesce(case when length(v_documento)=11 then cpf else cnpj end,''),'[^0-9]','','g')=v_documento
        or regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g')=v_telefone) then
     raise exception 'Já existe um cadastro com dados diferentes. Peça à equipe para conferir o documento e o telefone antes de continuar.' using errcode='22023';
   end if;
   insert into public.clientes(nome,cpf,cnpj,whatsapp,email,cep,endereco,numero,complemento,bairro,cidade,estado,origem,status)
   values(v_pedido.nome_contato,case when length(v_documento)=11 then v_documento else null end,case when length(v_documento)=14 then v_documento else null end,v_pedido.celular,p_dados->>'email',p_dados->>'cep',p_dados->>'endereco',p_dados->>'numero',p_dados->>'complemento',p_dados->>'bairro',p_dados->>'cidade',p_dados->>'estado','Site','Cliente') returning id into v_cliente;
 end if;
 update public.oportunidades set cliente_id=v_cliente,email=p_dados->>'email',cadastro_completo_em=now(),updated_at=now() where id=v_id;
 update public.orcamentos set cliente_id=v_cliente,dados_cliente_completos_em=now() where oportunidade_id=v_id and empresa_id=p_empresa_id and status='RASCUNHO';
 return jsonb_build_object('sucesso',true,'ja_completo',false);
end; $$;

revoke all on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) to service_role;
