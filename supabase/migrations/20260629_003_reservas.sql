create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete set null,
  kit_id uuid references public.kits(id) on delete set null,
  data_evento date not null,
  horario_evento text,
  endereco_evento text,
  valor_total numeric default 0,
  valor_sinal numeric default 0,
  status text default 'Pendente',
  observacoes text,
  created_at timestamptz default now()
);

alter table public.reservas enable row level security;

drop policy if exists "Usuários autenticados podem acessar reservas" on public.reservas;

create policy "Usuários autenticados podem acessar reservas"
on public.reservas
for all
to authenticated
using (true)
with check (true);
