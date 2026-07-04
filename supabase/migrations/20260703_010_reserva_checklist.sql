create table if not exists public.reserva_checklist (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete cascade,
  etapa text not null check (etapa in ('Separação', 'Entrega', 'Devolução')),
  item text not null,
  concluido boolean default false,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.reserva_checklist enable row level security;

drop policy if exists "Usuários autenticados podem acessar reserva_checklist" on public.reserva_checklist;

create policy "Usuários autenticados podem acessar reserva_checklist"
on public.reserva_checklist
for all
to authenticated
using (true)
with check (true);
