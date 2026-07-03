alter table public.reservas
add column if not exists status_pagamento text default 'Pendente',
add column if not exists data_pagamento_sinal date,
add column if not exists data_pagamento_final date,
add column if not exists forma_pagamento_sinal text,
add column if not exists forma_pagamento_final text;

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria text,
  valor numeric not null default 0,
  data_vencimento date,
  data_pagamento date,
  forma_pagamento text,
  status text default 'Pendente',
  observacoes text,
  created_at timestamptz default now()
);

alter table public.despesas enable row level security;

drop policy if exists "Usuários autenticados podem acessar despesas" on public.despesas;

create policy "Usuários autenticados podem acessar despesas"
on public.despesas
for all
to authenticated
using (true)
with check (true);
