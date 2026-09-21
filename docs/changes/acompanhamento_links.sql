-- Additive change: does not modify existing customers, orders or inventory.
create table public.acompanhamento_links (
  oportunidade_id uuid primary key references public.oportunidades(id),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.acompanhamento_links enable row level security;
revoke all on public.acompanhamento_links from public, anon, authenticated;
grant select, insert, update, delete on public.acompanhamento_links to service_role;
comment on table public.acompanhamento_links is 'Hashed private tracking tokens. Server-only access with tenant authorization and expiry/revocation checks.';
