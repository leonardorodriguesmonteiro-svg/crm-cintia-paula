begin;
alter table public.estoque_itens add column valor_locacao numeric(12,2) check (valor_locacao >= 0);
alter table public.oportunidades add column cadastro_completo_em timestamptz;
create table public.acompanhamento_aprovacao_envios (like public.acompanhamento_envios including defaults including constraints including indexes);
alter table public.acompanhamento_aprovacao_envios add foreign key (oportunidade_id) references public.oportunidades(id);
alter table public.acompanhamento_aprovacao_envios enable row level security;
revoke all on public.acompanhamento_aprovacao_envios from public, anon, authenticated;
grant select,insert,update on public.acompanhamento_aprovacao_envios to service_role;

create function public.preencher_preco_pre_reserva() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.tipo='ITEM_ESTOQUE' and new.valor_referencia is null then
  select valor_locacao into new.valor_referencia from public.estoque_itens where id=new.estoque_item_id;
 end if;
 return new;
end; $$;
revoke all on function public.preencher_preco_pre_reserva() from public, anon, authenticated;
create trigger preencher_preco_pre_reserva before insert on public.oportunidade_itens for each row execute function public.preencher_preco_pre_reserva();

create function public.completar_cadastro_pre_reserva(p_empresa_id uuid,p_token_hash text,p_dados jsonb) returns jsonb
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
 if coalesce(p_dados->>'cpf','') !~ '^[0-9]{11}$' or coalesce(p_dados->>'cep','') !~ '^[0-9]{8}$'
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
 insert into public.clientes(nome,cpf,whatsapp,email,cep,endereco,numero,complemento,bairro,cidade,estado,origem,status)
 values(v_pedido.nome_contato,p_dados->>'cpf',v_pedido.celular,p_dados->>'email',p_dados->>'cep',p_dados->>'endereco',p_dados->>'numero',p_dados->>'complemento',p_dados->>'bairro',p_dados->>'cidade',p_dados->>'estado','Site','Cliente') returning id into v_cliente;
 update public.oportunidades set cliente_id=v_cliente,email=p_dados->>'email',cadastro_completo_em=now(),updated_at=now() where id=v_id;
 update public.orcamentos set cliente_id=v_cliente,dados_cliente_completos_em=now() where oportunidade_id=v_id and empresa_id=p_empresa_id and status='RASCUNHO';
 return jsonb_build_object('sucesso',true,'ja_completo',false);
end; $$;
revoke all on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) to service_role;

-- Preserve the legacy accepted-proposal journey. New draft sends require completed intake.
create function public.aplicar_cadastro_pre_reserva_orcamento() returns trigger language plpgsql security invoker set search_path='' as $$
declare v_data timestamptz; v_cliente uuid;
begin
 if new.oportunidade_id is null then return new; end if;
 select cadastro_completo_em,cliente_id into v_data,v_cliente from public.oportunidades where id=new.oportunidade_id and empresa_id=new.empresa_id;
 if (tg_op='INSERT' and new.status='ENVIADA') or (tg_op='UPDATE' and old.status='RASCUNHO' and new.status='ENVIADA') then
  if v_data is null then raise exception 'Aguarde o cliente completar o cadastro pelo link da pré-reserva antes de finalizar o orçamento.' using errcode='22023'; end if;
 end if;
 if v_data is not null then
  new.cliente_id:=v_cliente; new.dados_cliente_completos_em:=v_data;
  if new.status='ACEITA' and (new.formalizacao_status is null or new.formalizacao_status='AGUARDANDO_DADOS') then new.formalizacao_status:='DADOS_COMPLETOS'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.aplicar_cadastro_pre_reserva_orcamento() from public,anon,authenticated;
create trigger zzz_cadastro_pre_reserva_orcamento before insert or update on public.orcamentos for each row execute function public.aplicar_cadastro_pre_reserva_orcamento();
commit;
