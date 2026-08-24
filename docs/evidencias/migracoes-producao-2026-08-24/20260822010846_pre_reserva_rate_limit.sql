-- Sprint Comercial 1.1 - Etapa 3
-- Rate limit persistente do endpoint publico, sem armazenar endereco IP original.

create table if not exists public.pre_reserva_rate_limits (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  chave_hash text not null,
  janela_inicio timestamptz not null,
  requisicoes integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (empresa_id, chave_hash, janela_inicio),
  constraint pre_reserva_rate_limits_chave_check check (chave_hash ~ '^[0-9a-f]{64}$'),
  constraint pre_reserva_rate_limits_requisicoes_check check (requisicoes > 0)
);
create index if not exists pre_reserva_rate_limits_limpeza_idx on public.pre_reserva_rate_limits (janela_inicio);
alter table public.pre_reserva_rate_limits enable row level security;
revoke all on table public.pre_reserva_rate_limits from public, anon, authenticated;

create or replace function public.consumir_limite_pre_reserva_servidor(
  p_empresa_id uuid,
  p_chave_hash text,
  p_limite integer,
  p_janela_segundos integer
)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_janela_inicio timestamptz; v_requisicoes integer;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then raise exception using errcode='42501', message='Funcao exclusiva do servidor.'; end if;
  if p_chave_hash !~ '^[0-9a-f]{64}$' or p_limite not between 1 and 100 or p_janela_segundos not between 60 and 86400 then raise exception using errcode='22023', message='Parametros de limite invalidos.'; end if;
  if not exists (select 1 from public.empresas empresa where empresa.id=p_empresa_id) then raise exception using errcode='22023', message='Empresa nao encontrada.'; end if;
  v_janela_inicio := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_janela_segundos) * p_janela_segundos);
  insert into public.pre_reserva_rate_limits (empresa_id,chave_hash,janela_inicio,requisicoes)
  values (p_empresa_id,p_chave_hash,v_janela_inicio,1)
  on conflict (empresa_id,chave_hash,janela_inicio)
  do update set requisicoes=public.pre_reserva_rate_limits.requisicoes+1,updated_at=now()
  where public.pre_reserva_rate_limits.requisicoes < p_limite
  returning requisicoes into v_requisicoes;
  delete from public.pre_reserva_rate_limits limite
  where limite.empresa_id=p_empresa_id and limite.chave_hash=p_chave_hash and limite.janela_inicio < v_janela_inicio - interval '1 day';
  return v_requisicoes is not null;
end;
$$;
revoke all on function public.consumir_limite_pre_reserva_servidor(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.consumir_limite_pre_reserva_servidor(uuid,text,integer,integer) to service_role;
