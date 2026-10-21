begin;
do $$
declare
 e uuid; c uuid; o uuid; novo uuid; resultado jsonb; dados jsonb; antes jsonb;
 token text := repeat('c',64); telefone text := '11987654321'; documento text := '98765432109';
begin
 select id into e from public.empresas limit 1;
 insert into public.clientes(nome,cpf,whatsapp,email,endereco)
 values('Cliente existente preservado',documento,telefone,'original@example.com','Rua original') returning id into c;
 insert into public.oportunidades(empresa_id,nome_contato,celular,etapa,origem)
 values(e,'Nome do pedido de teste',telefone,'APROVADA','Teste') returning id into o;
 insert into public.acompanhamento_links(oportunidade_id,token_hash,expires_at) values(o,token,now()+interval '1 hour');
 dados := jsonb_build_object('cpf',documento,'email','teste@example.com','cep','01001000','endereco','Rua de teste','numero','10','bairro','Centro','cidade','São Paulo','estado','SP');
 resultado := public.completar_cadastro_pre_reserva(e,token,dados);
 if not (resultado->>'sucesso')::boolean then raise exception 'Cadastro não concluído'; end if;
 if (select cliente_id from public.oportunidades where id=o) <> c then raise exception 'Cliente não reaproveitado'; end if;
 if (select count(*) from public.clientes where cpf=documento) <> 1 then raise exception 'Cliente duplicado'; end if;
 if not exists(select 1 from public.clientes where id=c and nome='Cliente existente preservado' and endereco='Rua original' and email='original@example.com' and numero='10' and cep='01001000') then raise exception 'Dados existentes substituídos ou ausentes não preenchidos'; end if;
 select to_jsonb(x) into antes from public.clientes x where id=c;
 resultado := public.completar_cadastro_pre_reserva(e,token,dados || '{"numero":"999"}'::jsonb);
 if not (resultado->>'ja_completo')::boolean or antes<>(select to_jsonb(x) from public.clientes x where id=c) then raise exception 'Reenvio não idempotente'; end if;
 update public.oportunidades set cadastro_completo_em=null,cliente_id=null where id=o;
 begin
  perform public.completar_cadastro_pre_reserva(e,token,dados || '{"cpf":"12345678901"}'::jsonb);
  raise exception 'Telefone de outro cliente aceito';
 exception when invalid_parameter_value then null; end;
 if antes<>(select to_jsonb(x) from public.clientes x where id=c) then raise exception 'Cadastro alheio alterado'; end if;
 update public.oportunidades set celular='11987654322' where id=o;
 begin
  perform public.completar_cadastro_pre_reserva(e,token,dados);
  raise exception 'Documento de outro contato aceito';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.completar_cadastro_pre_reserva(gen_random_uuid(),token,dados);
  raise exception 'Empresa diferente aceita';
 exception when invalid_parameter_value then null; end;
 update public.acompanhamento_links set revoked_at=now() where oportunidade_id=o;
 begin
  perform public.completar_cadastro_pre_reserva(e,token,dados);
  raise exception 'Link revogado aceito';
 exception when invalid_parameter_value then null; end;
 update public.acompanhamento_links set revoked_at=null where oportunidade_id=o;
 -- Um cliente novo com CNPJ continua sendo criado e pode ser reutilizado.
 dados := dados || '{"cpf":"11222333000181"}'::jsonb;
 resultado := public.completar_cadastro_pre_reserva(e,token,dados);
 select cliente_id into novo from public.oportunidades where id=o;
 if novo=c or not exists(select 1 from public.clientes where id=novo and cnpj='11222333000181' and cpf is null) then raise exception 'Cadastro PJ incorreto'; end if;
 update public.oportunidades set cadastro_completo_em=null where id=o;
 resultado := public.completar_cadastro_pre_reserva(e,token,dados);
 if (select cliente_id from public.oportunidades where id=o)<>novo then raise exception 'CNPJ não reutilizado'; end if;
 if has_function_privilege('anon','public.completar_cadastro_pre_reserva(uuid,text,jsonb)','execute') or has_function_privilege('authenticated','public.completar_cadastro_pre_reserva(uuid,text,jsonb)','execute') then raise exception 'Função exposta'; end if;
end $$;
rollback;
select 'PASS: CPF existente, dados preservados, campos ausentes preenchidos, reenvio, conflitos, empresa, revogação, criação e reuso de CNPJ; rollback.' as resultado;
