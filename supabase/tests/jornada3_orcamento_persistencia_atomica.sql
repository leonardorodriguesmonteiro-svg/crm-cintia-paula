begin;

do $teste$
declare
  v_empresa uuid;
  v_usuario uuid;
  v_primeiro jsonb;
  v_repetido jsonb;
  v_atualizado jsonb;
  v_conflito_detectado boolean := false;
begin
  select vinculo.empresa_id, vinculo.usuario_id
    into v_empresa, v_usuario
  from public.usuarios_empresa vinculo
  where vinculo.ativo = true
    and vinculo.perfil in ('Administrador', 'Comercial')
  limit 1;

  if v_empresa is null or v_usuario is null then
    raise exception 'Homologação sem usuário comercial ativo para o teste.';
  end if;

  v_primeiro := public.salvar_orcamento_jornada3_servidor(
    v_empresa, v_usuario, null, null, 'teste-rollback-orcamento3',
    'EM_EDICAO', 'MANUAL', null, 'Cliente de teste', '21999999999',
    'teste@example.com', 'Tema de teste', date '2027-02-10', '18:00',
    date '2027-02-10', time '09:00', date '2027-02-11',
    'Endereço de teste', 'Teste transacional', 'VALOR', 0,
    '[{"tipo_origem":"LIVRE","descricao":"Item livre","quantidade":1,"preco_base":100,"preco_unitario_orcamento":100,"desconto":0,"ordem":0}]'::jsonb,
    '[{"descricao":"Entrega","valor":10,"tipo":"ENTREGA","ordem":0}]'::jsonb
  );

  if (v_primeiro->>'criado')::boolean is not true
    or (v_primeiro->>'total')::numeric <> 110 then
    raise exception 'Criação atômica não produziu o resultado esperado: %', v_primeiro;
  end if;

  v_repetido := public.salvar_orcamento_jornada3_servidor(
    v_empresa, v_usuario, null, null, 'teste-rollback-orcamento3',
    'EM_EDICAO', 'MANUAL', null, 'Cliente de teste', '21999999999',
    'teste@example.com', 'Tema de teste', date '2027-02-10', '18:00',
    date '2027-02-10', time '09:00', date '2027-02-11',
    'Endereço de teste', 'Teste transacional', 'VALOR', 0,
    '[]'::jsonb, '[]'::jsonb
  );

  if v_repetido->>'id' <> v_primeiro->>'id'
    or (v_repetido->>'alterado')::boolean is not false then
    raise exception 'Idempotência falhou: %', v_repetido;
  end if;

  v_atualizado := public.salvar_orcamento_jornada3_servidor(
    v_empresa, v_usuario, (v_primeiro->>'id')::uuid,
    (v_primeiro->>'versao')::integer, null, 'FINALIZADO', 'MANUAL', null,
    'Cliente de teste', '21999999999', 'teste@example.com', 'Tema de teste',
    date '2027-02-10', '18:00', date '2027-02-10', time '09:00',
    date '2027-02-11', 'Endereço de teste', 'Teste atualizado',
    'PERCENTUAL', 10,
    '[{"tipo_origem":"LIVRE","descricao":"Item livre","quantidade":2,"preco_base":50,"preco_unitario_orcamento":50,"desconto":10,"ordem":0}]'::jsonb,
    '[{"descricao":"Entrega","valor":10,"tipo":"ENTREGA","ordem":0}]'::jsonb
  );

  if v_atualizado->>'status' <> 'FINALIZADO'
    or (v_atualizado->>'versao')::integer <> 2
    or (v_atualizado->>'subtotal')::numeric <> 90
    or (v_atualizado->>'total')::numeric <> 91 then
    raise exception 'Atualização atômica falhou: %', v_atualizado;
  end if;

  begin
    perform public.salvar_orcamento_jornada3_servidor(
      v_empresa, v_usuario, (v_primeiro->>'id')::uuid, 1, null,
      'EM_EDICAO', 'MANUAL', null, 'Cliente de teste', '21999999999',
      'teste@example.com', 'Tema de teste', date '2027-02-10', '18:00',
      date '2027-02-10', time '09:00', date '2027-02-11',
      'Endereço de teste', null, 'VALOR', 0,
      '[{"tipo_origem":"LIVRE","descricao":"Item livre","quantidade":1,"preco_base":100,"preco_unitario_orcamento":100}]'::jsonb,
      '[]'::jsonb
    );
  exception when sqlstate '40001' then
    v_conflito_detectado := true;
  end;

  if not v_conflito_detectado then
    raise exception 'Concorrência otimista não detectou versão obsoleta.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.salvar_orcamento_jornada3_servidor(uuid,uuid,uuid,integer,text,text,text,uuid,text,text,text,text,date,text,date,time without time zone,date,text,text,text,numeric,jsonb,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated recebeu EXECUTE indevidamente.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.salvar_orcamento_jornada3_servidor(uuid,uuid,uuid,integer,text,text,text,uuid,text,text,text,text,date,text,date,time without time zone,date,text,text,text,numeric,jsonb,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Service role não recebeu EXECUTE.';
  end if;
end;
$teste$;

rollback;
