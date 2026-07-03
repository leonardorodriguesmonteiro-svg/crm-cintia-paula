create table if not exists public.reserva_timeline (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo text default 'Sistema',
  created_at timestamptz default now()
);

alter table public.reserva_timeline enable row level security;

drop policy if exists "Usuários autenticados podem acessar reserva_timeline" on public.reserva_timeline;

create policy "Usuários autenticados podem acessar reserva_timeline"
on public.reserva_timeline
for all
to authenticated
using (true)
with check (true);
