begin;
select set_config('request.jwt.claim.role','service_role',true);
do $$
declare
 e uuid; u uuid; k uuid; k_preco numeric; criado jsonb; pedido uuid; linha uuid;
 versao integer; resultado jsonb; itens jsonb; antes jsonb; depois jsonb;
begin
 select empresa_id,usuario_id into e,u from public.usuarios_empresa where ativo and perfil in ('Administrador','Comercial') limit 1;
 select id,valor into k,k_preco from public.kits where empresa_id=e and status is distinct from 'Inativo' limit 1;
 if k is null or u is null then raise exception 'Fixture comercial ausente'; end if;
 criado := public.criar_pre_reserva_servidor(e,u,null,'Teste rollback editor','11999990000',null,'ERP','teste-editor-'||gen_random_uuid(),'2027-01-20','Teste transacional',jsonb_build_array(jsonb_build_object('tipo','KIT','kit_id',k,'quantidade',1)));
 pedido := (criado->>'id')::uuid;
 select id into linha from public.oportunidade_itens where oportunidade_id=pedido limit 1;
 select o.versao into versao from public.oportunidades o where id=pedido;
 itens := jsonb_build_array(jsonb_build_object('id',linha,'nome_snapshot','Kit negociado','quantidade',2,'valor_referencia',100.10),jsonb_build_object('tipo','KIT','kit_id',k,'nome_snapshot','Segundo kit','quantidade',1,'valor_referencia',50));
 resultado := public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'PERCENTUAL',10,itens);
 if (resultado->>'total')::numeric <> 225.18 then raise exception 'Total incorreto %',resultado; end if;
 if (select count(*) from public.oportunidade_itens where oportunidade_id=pedido) <> 2 then raise exception 'Inclusão falhou'; end if;
 if not exists(select 1 from public.oportunidade_itens where id=linha and nome_snapshot='Kit negociado' and quantidade=2 and valor_referencia=100.10) then raise exception 'Edição não persistiu'; end if;
 if (select valor from public.kits where id=k) is distinct from k_preco then raise exception 'Preço do catálogo alterado'; end if;
 begin
   perform public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'VALOR',0,itens);
   raise exception 'Versão obsoleta aceita';
 exception when serialization_failure then null; end;
 select o.versao,to_jsonb(o) into versao,antes from public.oportunidades o where id=pedido;
 begin
   perform public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'VALOR',99999,itens);
   raise exception 'Desconto inválido aceito';
 exception when check_violation then null; end;
 select to_jsonb(o) into depois from public.oportunidades o where id=pedido;
 if antes <> depois or (select count(*) from public.oportunidade_itens where oportunidade_id=pedido)<>2 then raise exception 'Rollback parcial'; end if;
 begin
   perform public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'VALOR',0,jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'nome_snapshot','Item externo','quantidade',1,'valor_referencia',10)));
   raise exception 'Item externo aceito';
 exception when insufficient_privilege then null; end;
 begin
   perform public.editar_itens_pre_reserva_servidor(e,pedido,gen_random_uuid(),versao,'VALOR',0,itens);
   raise exception 'Usuário não autorizado aceito';
 exception when insufficient_privilege then null; end;
 begin
   perform public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'VALOR',0,'[]');
   raise exception 'Pedido vazio aceito';
 exception when invalid_parameter_value then null; end;
 begin
   perform public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'VALOR',0,jsonb_build_array(jsonb_build_object('id',linha,'nome_snapshot','Sem preço','quantidade',1,'valor_referencia',null)));
   raise exception 'Preço vazio aceito';
 exception when invalid_parameter_value then null; end;
 resultado := public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'VALOR',0,jsonb_build_array(jsonb_build_object('id',linha,'nome_snapshot','Item gratuito','quantidade',1,'valor_referencia',0)));
 if (resultado->>'total')::numeric <> 0 or (select count(*) from public.oportunidade_itens where oportunidade_id=pedido)<>1 then raise exception 'Remoção ou preço zero falhou'; end if;
 update public.oportunidades set etapa='RECUSADA' where id=pedido;
 select o.versao into versao from public.oportunidades o where id=pedido;
 begin
   perform public.editar_itens_pre_reserva_servidor(e,pedido,u,versao,'VALOR',0,itens);
   raise exception 'Pedido encerrado editado';
 exception when check_violation then null; end;
 if has_function_privilege('anon','public.editar_itens_pre_reserva_servidor(uuid,uuid,uuid,integer,text,numeric,jsonb)','execute')
 or has_function_privilege('authenticated','public.editar_itens_pre_reserva_servidor(uuid,uuid,uuid,integer,text,numeric,jsonb)','execute') then raise exception 'RPC exposta'; end if;
end $$;
rollback;
select 'PASS: editar/adicionar/remover, preço zero, desconto, catálogo preservado, conflito, autorização, estado encerrado e rollback' as resultado;
