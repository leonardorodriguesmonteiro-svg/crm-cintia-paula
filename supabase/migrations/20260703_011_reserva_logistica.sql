create table if not exists public.reserva_logistica (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete cascade,
  etapa text not null check (etapa in ('Separação', 'Entrega', 'Devolução')),
  responsavel text,
  horario_previsto timestamptz,
  horario_realizado timestamptz,
  status text default 'Pendente' check (status in ('Pendente', 'Em andamento', 'Concluído')),
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reserva_logistica enable row level security;

drop policy if exists "Usuários autenticados podem acessar reserva_logistica" on public.reserva_logistica;

create policy "Usuários autenticados podem acessar reserva_logistica"
on public.reserva_logistica
for all
to authenticated
using (true)
with check (true);
