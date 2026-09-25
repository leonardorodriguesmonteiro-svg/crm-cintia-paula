-- Compatibilidade com as Secret Keys modernas do Supabase.
-- A permissao EXECUTE ja restringe a RPC ao backend service_role; a leitura
-- de request.jwt.claim.role depende do JWT legado e bloqueia sb_secret_*.

do $migration$
declare
  v_oid oid;
  v_def text;
  v_novo text;
  v_pattern text :=
    'if[[:space:]]+current_setting\(''request\.jwt\.claim\.role'',[[:space:]]*true\)[[:space:]]+is[[:space:]]+distinct[[:space:]]+from[[:space:]]+''service_role''[[:space:]]+then[[:space:]]+raise[[:space:]]+exception[[:space:]]+using[[:space:]]+errcode[[:space:]]*=[[:space:]]*''42501'',[[:space:]]*message[[:space:]]*=[[:space:]]*''[^'']+'';[[:space:]]*end[[:space:]]+if;';
begin
  select p.oid
    into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'ajustar_valores_pre_reserva_servidor'
    and pg_get_function_identity_arguments(p.oid)
      = 'p_empresa_id uuid, p_oportunidade_id uuid, p_usuario_id uuid, p_versao_esperada integer, p_desconto_tipo text, p_desconto_valor numeric';

  if v_oid is null then
    raise exception 'RPC ajustar_valores_pre_reserva_servidor nao encontrada.';
  end if;

  v_def := pg_get_functiondef(v_oid);
  v_novo := regexp_replace(v_def, v_pattern, '', 'g');

  if v_novo = v_def then
    raise exception 'A checagem JWT legacy nao foi localizada.';
  end if;

  execute v_novo;
end;
$migration$;

revoke all on function public.ajustar_valores_pre_reserva_servidor(
  uuid, uuid, uuid, integer, text, numeric
) from public, anon, authenticated, service_role;

grant execute on function public.ajustar_valores_pre_reserva_servidor(
  uuid, uuid, uuid, integer, text, numeric
) to service_role;
