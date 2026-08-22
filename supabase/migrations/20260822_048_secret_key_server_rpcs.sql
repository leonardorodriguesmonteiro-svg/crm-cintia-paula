-- Compatibilidade das RPCs server-only com as Secret Keys modernas do Supabase.
--
-- As funcoes abaixo ja sao protegidas por EXECUTE exclusivamente para service_role.
-- A verificacao interna de request.jwt.claim.role dependia do JWT legacy e bloqueava
-- chamadas autenticadas por sb_secret_*, mesmo quando o PostgREST ja havia autorizado
-- a execucao como service_role.
--
-- Esta migration remove apenas a checagem JWT redundante e reafirma os grants.

do $migration$
declare
  v_oid oid;
  v_def text;
  v_novo text;
  v_nome text;
  v_pattern text :=
    'if[[:space:]]+current_setting\(''request\.jwt\.claim\.role'',[[:space:]]*true\)[[:space:]]+is[[:space:]]+distinct[[:space:]]+from[[:space:]]+''service_role''[[:space:]]+then[[:space:]]+raise[[:space:]]+exception[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*''42501'',[[:space:]]*message[[:space:]]*=[[:space:]]*''[^'']+'';[[:space:]]*end[[:space:]]+if;';
begin
  for v_oid, v_nome in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.proname in (
        'cancelar_envio_proposta_servidor',
        'completar_dados_cliente_proposta_servidor',
        'conciliar_pagamento_mercado_pago',
        'consumir_limite_pre_reserva_servidor',
        'criar_pre_reserva_servidor',
        'enviar_proposta_servidor',
        'registrar_assinatura_publica_contrato',
        'registrar_resposta_publica_orcamento',
        'transicionar_pre_reserva_servidor'
      )
  loop
    v_def := pg_get_functiondef(v_oid);
    v_novo := regexp_replace(v_def, v_pattern, '', 'g');

    if v_novo = v_def then
      raise exception 'A checagem JWT legacy nao foi localizada em %.', v_nome;
    end if;

    execute v_novo;
  end loop;
end;
$migration$;

-- Defesa em profundidade: nenhuma destas RPCs pode ser executada por clientes
-- publicos ou usuarios autenticados. Somente o backend com service_role.
revoke all on function public.consumir_limite_pre_reserva_servidor(uuid, text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.consumir_limite_pre_reserva_servidor(uuid, text, integer, integer)
  to service_role;

revoke all on function public.criar_pre_reserva_servidor(uuid, uuid, uuid, text, text, text, text, text, date, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.criar_pre_reserva_servidor(uuid, uuid, uuid, text, text, text, text, text, date, text, jsonb)
  to service_role;

revoke all on function public.transicionar_pre_reserva_servidor(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.transicionar_pre_reserva_servidor(uuid, uuid, uuid, integer, text, text)
  to service_role;

revoke all on function public.registrar_resposta_publica_orcamento(uuid, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.registrar_resposta_publica_orcamento(uuid, text, text, text)
  to service_role;

revoke all on function public.completar_dados_cliente_proposta_servidor(uuid, text, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.completar_dados_cliente_proposta_servidor(uuid, text, text, text, text, text)
  to service_role;

revoke all on function public.enviar_proposta_servidor(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.enviar_proposta_servidor(uuid, uuid, uuid)
  to service_role;

revoke all on function public.cancelar_envio_proposta_servidor(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.cancelar_envio_proposta_servidor(uuid, uuid, uuid)
  to service_role;

revoke all on function public.registrar_assinatura_publica_contrato(uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.registrar_assinatura_publica_contrato(uuid, text, text, text, text)
  to service_role;

revoke all on function public.conciliar_pagamento_mercado_pago(uuid, text, text, text, text, numeric, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.conciliar_pagamento_mercado_pago(uuid, text, text, text, text, numeric, timestamptz)
  to service_role;
