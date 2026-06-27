create extension if not exists "pgcrypto";

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text,
  whatsapp text,
  instagram text,
  email text,
  endereco text,
  bairro text,
  cidade text,
  data_nascimento date,
  origem text,
  status text default 'Cliente',
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists clientes_cpf_unique on public.clientes (cpf) where cpf is not null and cpf <> '';
create unique index if not exists clientes_whatsapp_unique on public.clientes (whatsapp) where whatsapp is not null and whatsapp <> '';

create table if not exists public.kits (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  tema text,
  categoria text,
  quantidade integer default 1,
  valor numeric default 0,
  valor_fim_semana numeric default 0,
  foto_url text,
  descricao text,
  observacoes text,
  status text default 'Disponível',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists kits_codigo_unique on public.kits (codigo) where codigo is not null and codigo <> '';

create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  categoria text,
  cor text,
  quantidade_total integer default 0,
  quantidade_manutencao integer default 0,
  valor_reposicao numeric default 0,
  fornecedor text,
  foto_url text,
  status text default 'Disponível',
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists estoque_codigo_unique on public.estoque_itens (codigo) where codigo is not null and codigo <> '';

create table if not exists public.kit_itens (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid references public.kits(id) on delete cascade,
  item_id uuid references public.estoque_itens(id) on delete cascade,
  quantidade integer not null default 1,
  observacoes text,
  created_at timestamptz default now()
);
create unique index if not exists kit_itens_unique on public.kit_itens (kit_id, item_id);

alter table public.clientes enable row level security;
alter table public.kits enable row level security;
alter table public.estoque_itens enable row level security;
alter table public.kit_itens enable row level security;

drop policy if exists "auth clientes" on public.clientes;
drop policy if exists "auth kits" on public.kits;
drop policy if exists "auth estoque" on public.estoque_itens;
drop policy if exists "auth kit_itens" on public.kit_itens;

create policy "auth clientes" on public.clientes for all to authenticated using (true) with check (true);
create policy "auth kits" on public.kits for all to authenticated using (true) with check (true);
create policy "auth estoque" on public.estoque_itens for all to authenticated using (true) with check (true);
create policy "auth kit_itens" on public.kit_itens for all to authenticated using (true) with check (true);
