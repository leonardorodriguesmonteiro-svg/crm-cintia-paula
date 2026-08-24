-- Compatibiliza instalações reconstruídas a partir da migração-base com o
-- contrato esperado pelas funções servidoras da jornada comercial.
alter table public.empresas
  add column if not exists status text;

update public.empresas
set status = 'Ativa'
where status is null or btrim(status) = '';

alter table public.empresas
  alter column status set default 'Ativa',
  alter column status set not null;
