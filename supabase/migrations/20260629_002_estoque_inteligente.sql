create table if not exists public.estoque_itens (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  nome text not null,
  categoria text,
  cor text,
  quantidade_total integer default 0,
  quantidade_disponivel integer default 0,
  quantidade_manutencao integer default 0,
  valor_reposicao numeric default 0,
  localizacao text,
  foto_url text,
  observacoes text,
  status text default 'Disponível',
  created_at timestamptz default now()
);

create table if not exists public.kit_composicao (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid references public.kits(id) on delete cascade,
  item_id uuid references public.estoque_itens(id) on delete cascade,
  quantidade integer default 1,
  observacoes text,
  created_at timestamptz default now()
);

alter table public.estoque_itens enable row level security;
alter table public.kit_composicao enable row level security;

drop policy if exists "Usuários autenticados podem acessar estoque_itens" on public.estoque_itens;
create policy "Usuários autenticados podem acessar estoque_itens"
on public.estoque_itens
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Usuários autenticados podem acessar kit_composicao" on public.kit_composicao;
create policy "Usuários autenticados podem acessar kit_composicao"
on public.kit_composicao
for all
to authenticated
using (true)
with check (true);

create unique index if not exists estoque_itens_codigo_unique
on public.estoque_itens (codigo)
where codigo is not null and codigo <> '';

create unique index if not exists kit_composicao_kit_item_unique
on public.kit_composicao (kit_id, item_id)
where kit_id is not null and item_id is not null;