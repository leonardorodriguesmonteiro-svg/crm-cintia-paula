create table if not exists public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete set null,
  tipo text not null check (tipo in ('Receita', 'Despesa')),
  descricao text not null,
  categoria text,
  valor numeric not null default 0,
  data_vencimento date,
  data_pagamento date,
  forma_pagamento text,
  status text default 'Pendente' check (status in ('Pendente', 'Pago', 'Cancelado')),
  observacoes text,
  created_at timestamptz default now()
);

alter table public.lancamentos_financeiros enable row level security;

drop policy if exists "Usuários autenticados podem acessar lançamentos financeiros" on public.lancamentos_financeiros;

create policy "Usuários autenticados podem acessar lançamentos financeiros"
on public.lancamentos_financeiros
for all
to authenticated
using (true)
with check (true);
