create table if not exists public.modelos_contrato (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  tipo_evento text,
  ativo boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.clausulas_contrato (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  texto text not null,
  categoria text,
  obrigatoria boolean default true,
  ativa boolean default true,
  ordem integer default 0,
  condicao text,
  created_at timestamptz default now()
);

create table if not exists public.modelo_clausulas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid references public.modelos_contrato(id) on delete cascade,
  clausula_id uuid references public.clausulas_contrato(id) on delete cascade,
  ordem integer default 0,
  obrigatoria boolean default true,
  created_at timestamptz default now()
);

-- A tabela de contratos existia na V3, mas precisa fazer parte da instalação
-- limpa da V6 antes das versões e da formalização comercial.
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references public.reservas(id) on delete cascade,
  numero_contrato text not null unique,
  status text default 'Gerado',
  observacoes text,
  pdf_url text,
  created_at timestamptz default now()
);

create table if not exists public.contrato_versoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid references public.contratos(id) on delete cascade,
  versao integer not null default 1,
  conteudo text not null,
  status text default 'Rascunho',
  created_at timestamptz default now()
);

alter table public.modelos_contrato enable row level security;
alter table public.clausulas_contrato enable row level security;
alter table public.modelo_clausulas enable row level security;
alter table public.contratos enable row level security;
alter table public.contrato_versoes enable row level security;

create policy "Usuários autenticados podem acessar modelos_contrato"
on public.modelos_contrato for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem acessar clausulas_contrato"
on public.clausulas_contrato for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem acessar modelo_clausulas"
on public.modelo_clausulas for all to authenticated using (true) with check (true);

drop policy if exists "Usuários autenticados podem acessar contratos"
on public.contratos;

create policy "Usuários autenticados podem acessar contratos"
on public.contratos for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem acessar contrato_versoes"
on public.contrato_versoes for all to authenticated using (true) with check (true);
