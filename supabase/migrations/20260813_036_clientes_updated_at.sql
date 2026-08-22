-- Compatibilidade para a jornada comercial V2.
-- A migration de complemento cadastral atualiza clientes.updated_at; alguns
-- bancos históricos ainda não possuem a coluna porque nasceram antes do RBAC.

alter table public.clientes
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.atualizar_cliente_timestamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists atualizar_cliente_timestamp on public.clientes;

create trigger atualizar_cliente_timestamp
before update on public.clientes
for each row execute function public.atualizar_cliente_timestamp();

revoke all on function public.atualizar_cliente_timestamp()
from public, anon, authenticated, service_role;
