-- Central de Feedback 2.0: triagem operacional, impacto e contexto técnico.
-- Migração não destrutiva: preserva os feedbacks existentes e apenas normaliza
-- os nomes dos estados antigos para a nova esteira administrativa.

begin;

alter table public.feedbacks
add column if not exists impacto text not null default 'Não classificado';

alter table public.feedbacks
add column if not exists navegador text;

alter table public.feedbacks
add column if not exists versao_app text;

update public.feedbacks
set status = 'Triagem',
    updated_at = now()
where status = 'Em análise';

update public.feedbacks
set status = 'Backlog',
    updated_at = now()
where status = 'Planejado';

alter table public.feedbacks
drop constraint if exists feedbacks_tipo_check;

alter table public.feedbacks
drop constraint if exists feedbacks_status_check;

alter table public.feedbacks
drop constraint if exists feedbacks_impacto_check;

alter table public.feedbacks
add constraint feedbacks_tipo_check
check (
  tipo in (
    'Erro',
    'Dificuldade',
    'Sugestão',
    'Necessidade operacional',
    'Elogio'
  )
);

alter table public.feedbacks
add constraint feedbacks_status_check
check (
  status in (
    'Novo',
    'Triagem',
    'Aprovado',
    'Backlog',
    'Em desenvolvimento',
    'Validação',
    'Concluído',
    'Descartado'
  )
);

alter table public.feedbacks
add constraint feedbacks_impacto_check
check (
  impacto in (
    'Não classificado',
    'Bloqueia operação',
    'Atrasa operação',
    'Melhoria importante',
    'Conveniência'
  )
);

create index if not exists feedbacks_impacto_idx
on public.feedbacks(impacto);

create index if not exists feedbacks_status_impacto_created_idx
on public.feedbacks(status, impacto, created_at desc);

commit;
