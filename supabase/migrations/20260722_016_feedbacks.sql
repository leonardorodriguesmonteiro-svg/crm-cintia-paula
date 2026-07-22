create table if not exists public.feedbacks (
  id uuid primary key default gen_random_uuid(),

  empresa_id uuid
    references public.empresas(id)
    on delete cascade,

  usuario_id uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  tipo text not null default 'Sugestão'
    check (
      tipo in (
        'Erro',
        'Dificuldade',
        'Sugestão',
        'Elogio'
      )
    ),

  mensagem text not null,
  pagina text,
  url text,

  status text not null default 'Novo'
    check (
      status in (
        'Novo',
        'Em análise',
        'Planejado',
        'Em desenvolvimento',
        'Concluído',
        'Descartado'
      )
    ),

  prioridade text not null default 'Não classificada'
    check (
      prioridade in (
        'Não classificada',
        'Crítica',
        'Alta',
        'Média',
        'Baixa'
      )
    ),

  resposta text,
  resolvido_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedbacks_usuario_id_idx
on public.feedbacks(usuario_id);

create index if not exists feedbacks_empresa_id_idx
on public.feedbacks(empresa_id);

create index if not exists feedbacks_status_idx
on public.feedbacks(status);

create index if not exists feedbacks_created_at_idx
on public.feedbacks(created_at desc);

alter table public.feedbacks enable row level security;

drop policy if exists "Usuário pode enviar feedback"
on public.feedbacks;

create policy "Usuário pode enviar feedback"
on public.feedbacks
for insert
to authenticated
with check (
  usuario_id = auth.uid()
);

drop policy if exists "Usuário pode visualizar seus feedbacks"
on public.feedbacks;

create policy "Usuário pode visualizar seus feedbacks"
on public.feedbacks
for select
to authenticated
using (
  usuario_id = auth.uid()
);

drop policy if exists "Usuário pode atualizar feedback novo"
on public.feedbacks;

create policy "Usuário pode atualizar feedback novo"
on public.feedbacks
for update
to authenticated
using (
  usuario_id = auth.uid()
  and status = 'Novo'
)
with check (
  usuario_id = auth.uid()
);
