begin;
do $$
declare
 empresa uuid; pedido uuid:=gen_random_uuid(); orcamento uuid:=gen_random_uuid(); item uuid:=gen_random_uuid();
 hash text:=encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex');
 dados jsonb:='{"cpf":"52998224725","cep":"20040020","endereco":"Rua Teste","numero":"1","bairro":"Centro","cidade":"Rio de Janeiro","estado":"RJ","email":"cadastro@example.invalid"}';
 resultado jsonb; cliente uuid; preco numeric; completo timestamptz; estado text;
begin
 select empresa_id into empresa from public.oportunidades where numero=15;
 insert into public.oportunidades(id,empresa_id,nome_contato,celular,email,etapa,data_evento) values(pedido,empresa,'TESTE TRANSACIONAL CADASTRO','11999999999','cadastro@example.invalid','RECEBIDA','2035-01-01');
 insert into public.acompanhamento_links(oportunidade_id,token_hash,expires_at) values(pedido,hash,now()+interval '1 hour');
 begin perform public.completar_cadastro_pre_reserva(empresa,hash,dados); raise exception 'TEST: unapproved intake accepted'; exception when sqlstate '22023' then null; end;
 update public.oportunidades set etapa='APROVADA' where id=pedido;
 begin perform public.completar_cadastro_pre_reserva(gen_random_uuid(),hash,dados); raise exception 'TEST: foreign company accepted'; exception when sqlstate '22023' then null; end;
 update public.acompanhamento_links set revoked_at=now() where oportunidade_id=pedido;
 begin perform public.completar_cadastro_pre_reserva(empresa,hash,dados); raise exception 'TEST: revoked accepted'; exception when sqlstate '22023' then null; end;
 update public.acompanhamento_links set revoked_at=null,expires_at=now()-interval '1 hour' where oportunidade_id=pedido;
 begin perform public.completar_cadastro_pre_reserva(empresa,hash,dados); raise exception 'TEST: expired accepted'; exception when sqlstate '22023' then null; end;
 update public.acompanhamento_links set expires_at=now()+interval '1 hour' where oportunidade_id=pedido;
 insert into public.orcamentos(id,empresa_id,oportunidade_id,status,data_evento) values(orcamento,empresa,pedido,'RASCUNHO','2035-01-01');
 begin update public.orcamentos set status='ENVIADA' where id=orcamento; raise exception 'TEST: incomplete draft sent'; exception when sqlstate '22023' then null; end;
 resultado:=public.completar_cadastro_pre_reserva(empresa,hash,dados);
 if resultado->>'sucesso'<>'true' then raise exception 'TEST: registration failed'; end if;
 select cliente_id,cadastro_completo_em into cliente,completo from public.oportunidades where id=pedido;
 if cliente is null or completo is null then raise exception 'TEST: not linked'; end if;
 resultado:=public.completar_cadastro_pre_reserva(empresa,hash,dados);
 if resultado->>'ja_completo'<>'true' then raise exception 'TEST: repeated registration duplicated'; end if;
 if (select cliente_id from public.oportunidades where id=pedido)<>cliente then raise exception 'TEST: customer changed'; end if;
 update public.orcamentos set status='ENVIADA' where id=orcamento;
 update public.orcamentos set status='ACEITA',formalizacao_status='AGUARDANDO_DADOS' where id=orcamento;
 select formalizacao_status into estado from public.orcamentos where id=orcamento;
 if estado<>'DADOS_COMPLETOS' then raise exception 'TEST: duplicate intake required after acceptance: %',estado; end if;
 insert into public.estoque_itens(id,nome,valor_locacao,valor_reposicao,quantidade_total,status) values(item,'TESTE PRECO TRANSACIONAL',25,300,1,'Disponível');
 insert into public.oportunidade_itens(empresa_id,oportunidade_id,tipo,estoque_item_id,nome_snapshot,quantidade,ordem) values(empresa,pedido,'ITEM_ESTOQUE',item,'TESTE PRECO TRANSACIONAL',1,0);
 select valor_referencia into preco from public.oportunidade_itens where oportunidade_id=pedido and estoque_item_id=item;
 if preco<>25 or preco is null then raise exception 'TEST: rental price not copied'; end if;
end; $$;
rollback;
select 'PASS: approval, tenant, revoked/expired links, idempotency, draft send gate, accepted intake reuse, rental price; all fixture data rolled back' resultado;
