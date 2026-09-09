-- A permissão de execução já restringe esta RPC à service_role. O teste de
-- claim duplicava essa barreira e entrava em conflito com a troca controlada
-- de claims usada internamente para reaproveitar as funções históricas.
do $$
declare
  v_assinatura regprocedure :=
    'public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text)'::regprocedure;
  v_definicao text;
  v_teste_claim text := $trecho$
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception 'Esta operação só pode ser executada pelo servidor do ERP.';
  end if;

$trecho$;
begin
  select pg_get_functiondef(v_assinatura) into v_definicao;

  if position(v_teste_claim in v_definicao) = 0 then
    raise exception 'Trecho esperado de autorização da formalização não encontrado.';
  end if;

  execute replace(v_definicao, v_teste_claim, '');
end;
$$;

revoke all on function public.executar_formalizacao_servidor(
  uuid, uuid, text, numeric, date, text
) from public, anon, authenticated;

grant execute on function public.executar_formalizacao_servidor(
  uuid, uuid, text, numeric, date, text
) to service_role;
