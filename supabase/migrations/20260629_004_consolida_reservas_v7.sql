alter table public.reservas
add column if not exists valor_sinal numeric default 0,
add column if not exists endereco_evento text,
add column if not exists horario_evento text,
add column if not exists data_evento date,
add column if not exists created_at timestamptz default now();

update public.reservas
set data_evento = coalesce(data_evento, data_festa)
where data_evento is null;

update public.reservas
set valor_sinal = coalesce(valor_sinal, entrada, 0)
where valor_sinal is null;

alter table public.reservas
alter column numero drop not null;

alter table public.reservas
alter column data_festa drop not null;

alter table public.reservas
drop constraint if exists reservas_status_check;

alter table public.reservas
add constraint reservas_status_check
check (status in (
  'Pendente',
  'Orçamento',
  'Confirmada',
  'Em andamento',
  'Concluída',
  'Cancelada'
));
