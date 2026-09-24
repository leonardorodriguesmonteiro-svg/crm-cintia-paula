-- Cadastro PJ no acompanhamento: executar apenas na janela de homologacao, apos backup.
begin;
alter table public.clientes add column if not exists cnpj text;
create unique index if not exists clientes_cnpj_unique on public.clientes(cnpj) where cnpj is not null and cnpj <> '';
create or replace function public.completar_cadastro_pre_reserva(p_empresa_id uuid,p_token_hash text,p_dados jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_cliente uuid; v_pedido public.oportunidades%rowtype;
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
 or coalesce(p_dados->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception 'Dados cadastrais inválidos.' using errcode='22023';
 end if;
 -- A private order link must never overwrite a different customer's record by CPF/phone lookup.
 -- Repeated submissions return above; one customer snapshot is created for this order.
 insert into public.clientes(nome,cpf,cnpj,whatsapp,email,cep,endereco,numero,complemento,bairro,cidade,estado,origem,status)
 values(v_pedido.nome_contato,case when length(p_dados->>'cpf')=11 then p_dados->>'cpf' else null end,case when length(p_dados->>'cpf')=14 then p_dados->>'cpf' else null end,v_pedido.celular,p_dados->>'email',p_dados->>'cep',p_dados->>'endereco',p_dados->>'numero',p_dados->>'complemento',p_dados->>'bairro',p_dados->>'cidade',p_dados->>'estado','Site','Cliente') returning id into v_cliente;
 update public.oportunidades set cliente_id=v_cliente,email=p_dados->>'email',cadastro_completo_em=now(),updated_at=now() where id=v_id;
 update public.orcamentos set cliente_id=v_cliente,dados_cliente_completos_em=now() where oportunidade_id=v_id and empresa_id=p_empresa_id and status='RASCUNHO';
 return jsonb_build_object('sucesso',true,'ja_completo',false);
end; $$;

revoke all on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) to service_role;
commit;
