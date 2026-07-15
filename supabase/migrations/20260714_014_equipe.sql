create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  funcao text,
  especialidades text,
  possui_veiculo boolean default false,
  observacoes text,
  ativo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ordem_servico_equipe (
  id uuid primary key default gen_random_uuid(),
  ordem_servico_id uuid not null
    references public.ordens_servico(id) on delete cascade,
  colaborador_id uuid not null
    references public.equipe(id) on delete cascade,
  funcao_na_os text,
  horario_inicio time,
  horario_fim time,
  observacoes text,
  created_at timestamptz default now(),
  unique (ordem_servico_id, colaborador_id)
);

alter table public.equipe enable row level security;
alter table public.ordem_servico_equipe enable row level security;

drop policy if exists "Usuários autenticados podem acessar equipe"
on public.equipe;

create policy "Usuários autenticados podem acessar equipe"
on public.equipe
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Usuários autenticados podem acessar ordem_servico_equipe"
on public.ordem_servico_equipe;

create policy "Usuários autenticados podem acessar ordem_servico_equipe"
on public.ordem_servico_equipe
for all
to authenticated
using (true)
with check (true);
