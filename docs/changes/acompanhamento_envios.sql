alter table public.acompanhamento_links add column if not exists token_cifrado text;
create table public.acompanhamento_envios (
 id uuid primary key default gen_random_uuid(),
 oportunidade_id uuid not null references public.oportunidades(id),
 token_hash text not null,
 canal text not null check (canal in ('email','whatsapp')),
 status text not null check (status in ('pendente','processando','aceito','falhou','nao_configurado','sem_consentimento','sem_destino','incerto')),
 provedor_id text,
 atualizado_em timestamptz not null default now(),
 unique(oportunidade_id, token_hash, canal)
);
alter table public.acompanhamento_envios enable row level security;
revoke all on public.acompanhamento_envios from public, anon, authenticated;
grant select,insert,update on public.acompanhamento_envios to service_role;
alter table public.acompanhamento_links add column if not exists whatsapp_consentido_em timestamptz;
