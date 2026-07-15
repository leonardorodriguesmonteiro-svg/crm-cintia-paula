create table if not exists public.timeline_global (
  id uuid primary key default gen_random_uuid(),

  empresa_id uuid references public.empresas(id) on delete cascade,
  reserva_id uuid references public.reservas(id) on delete cascade,

  entidade_tipo text not null default 'Reserva',
  entidade_id uuid,

  evento_codigo text,
  titulo text not null,
  descricao text,

  modulo text not null default 'Sistema',
  origem text not null default 'ERP',
  status text default 'Registrado',

  usuario_id uuid references auth.users(id) on delete set null,

  metadados jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists timeline_global_reserva_id_idx
on public.timeline_global(reserva_id);

create index if not exists timeline_global_entidade_idx
on public.timeline_global(entidade_tipo, entidade_id);

create index if not exists timeline_global_evento_codigo_idx
on public.timeline_global(evento_codigo);

create index if not exists timeline_global_created_at_idx
on public.timeline_global(created_at desc);

alter table public.timeline_global enable row level security;

drop policy if exists "Usuários autenticados podem acessar timeline_global"
on public.timeline_global;

create policy "Usuários autenticados podem acessar timeline_global"
on public.timeline_global
for all
to authenticated
using (true)
with check (true);
