create table if not exists public.ordens_servico (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete cascade,
  numero text not null unique,
  tipo text default 'Operacional',
  status text default 'Aberta',
  responsavel text,
  data_prevista date,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ordem_servico_itens (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid references public.ordens_servico(id) on delete cascade,
  etapa text not null,
  descricao text not null,
  concluido boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.ordens_servico enable row level security;
alter table public.ordem_servico_itens enable row level security;

create policy "Usuários autenticados podem acessar ordens_servico"
on public.ordens_servico
for all
to authenticated
using (true)
with check (true);

create policy "Usuários autenticados podem acessar ordem_servico_itens"
on public.ordem_servico_itens
for all
to authenticated
using (true)
with check (true);
