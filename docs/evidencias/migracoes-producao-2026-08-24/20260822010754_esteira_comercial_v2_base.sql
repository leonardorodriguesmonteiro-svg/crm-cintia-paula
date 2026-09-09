-- Sprint Comercial 1.1 - Etapa 1
-- Base compativel da nova jornada e isolamento multiempresa do modulo Comercial.
-- Esta migration nao converte estados existentes e nao remove dados historicos.

alter table public.oportunidades
  drop constraint if exists oportunidades_etapa_check;

alter table public.oportunidades
  add constraint oportunidades_etapa_check
  check (
    etapa in (
      'Novo contato','Em atendimento','Orçamento enviado','Negociação','Fechado','Perdido',
      'RECEBIDA','EM_ANALISE','AJUSTE_SOLICITADO','APROVADA','RECUSADA','CONVERTIDA_EM_PROPOSTA'
    )
  ) not valid;

alter table public.oportunidades validate constraint oportunidades_etapa_check;

alter table public.orcamentos drop constraint if exists orcamentos_status_check;
alter table public.orcamentos add constraint orcamentos_status_check
check (status in ('Rascunho','Enviado','Aprovado','Recusado','Expirado','RASCUNHO','ENVIADA','ACEITA','RECUSADA','EXPIRADA','CANCELADA')) not valid;
alter table public.orcamentos validate constraint orcamentos_status_check;

alter table public.orcamentos drop constraint if exists orcamentos_resposta_cliente_check;
alter table public.orcamentos add constraint orcamentos_resposta_cliente_check
check (resposta_cliente is null or resposta_cliente in ('Aprovado','Recusado','ACEITA','RECUSADA')) not valid;
alter table public.orcamentos validate constraint orcamentos_resposta_cliente_check;

alter table public.orcamentos drop constraint if exists orcamentos_formalizacao_status_check;
alter table public.orcamentos add constraint orcamentos_formalizacao_status_check
check (formalizacao_status is null or formalizacao_status in (
  'Aguardando formalização','Aguardando contrato','Aguardando sinal','Venda confirmada','Cancelada',
  'AGUARDANDO_DADOS','DADOS_COMPLETOS','CONTRATO_GERADO','CONTRATO_ENVIADO','AGUARDANDO_ASSINATURA','AGUARDANDO_PAGAMENTO','PRONTA_PARA_CONFIRMAR','RESERVA_CONFIRMADA','CANCELADA'
)) not valid;
alter table public.orcamentos validate constraint orcamentos_formalizacao_status_check;

alter table public.oportunidades
  add column if not exists origem_externa_id text,
  add column if not exists recebida_em timestamptz not null default now(),
  add column if not exists versao integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.oportunidades'::regclass and conname='oportunidades_origem_externa_id_tamanho_check') then
    alter table public.oportunidades add constraint oportunidades_origem_externa_id_tamanho_check check (origem_externa_id is null or char_length(origem_externa_id) between 1 and 200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.oportunidades'::regclass and conname='oportunidades_versao_check') then
    alter table public.oportunidades add constraint oportunidades_versao_check check (versao > 0) not valid;
  end if;
end $$;

alter table public.oportunidades validate constraint oportunidades_origem_externa_id_tamanho_check;
alter table public.oportunidades validate constraint oportunidades_versao_check;

create unique index if not exists oportunidades_empresa_origem_externa_unique on public.oportunidades (empresa_id, origem_externa_id) where origem_externa_id is not null;
create index if not exists oportunidades_empresa_etapa_atualizacao_idx on public.oportunidades (empresa_id, etapa, updated_at desc);
create index if not exists orcamentos_empresa_status_criacao_idx on public.orcamentos (empresa_id, status, created_at desc);

with vinculos_unicos as (
  select usuario_id, max(empresa_id::text)::uuid as empresa_id
  from public.usuarios_empresa where ativo=true group by usuario_id having count(distinct empresa_id)=1
)
update public.oportunidades oportunidade set empresa_id=vinculo.empresa_id
from vinculos_unicos vinculo
where oportunidade.empresa_id is null and vinculo.usuario_id=coalesce(oportunidade.responsavel_id,oportunidade.created_by);

do $$ declare v_empresa_id uuid; begin
  if (select count(*) from public.empresas)=1 then
    select id into v_empresa_id from public.empresas limit 1;
    update public.oportunidades set empresa_id=v_empresa_id where empresa_id is null;
  end if;
end $$;

update public.orcamentos orcamento set empresa_id=oportunidade.empresa_id
from public.oportunidades oportunidade
where orcamento.empresa_id is null and oportunidade.id=orcamento.oportunidade_id and oportunidade.empresa_id is not null;

with vinculos_unicos as (
  select usuario_id, max(empresa_id::text)::uuid as empresa_id
  from public.usuarios_empresa where ativo=true group by usuario_id having count(distinct empresa_id)=1
)
update public.orcamentos orcamento set empresa_id=vinculo.empresa_id
from vinculos_unicos vinculo
where orcamento.empresa_id is null and vinculo.usuario_id=orcamento.created_by;

do $$ declare v_empresa_id uuid; begin
  if (select count(*) from public.empresas)=1 then
    select id into v_empresa_id from public.empresas limit 1;
    update public.orcamentos set empresa_id=v_empresa_id where empresa_id is null;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.oportunidades'::regclass and conname='oportunidades_id_empresa_unique') then
    alter table public.oportunidades add constraint oportunidades_id_empresa_unique unique (id, empresa_id);
  end if;
end $$;

create table if not exists public.oportunidade_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  oportunidade_id uuid not null,
  tipo text not null,
  kit_id uuid references public.kits(id) on delete restrict,
  estoque_item_id uuid references public.estoque_itens(id) on delete restrict,
  nome_snapshot text not null,
  valor_referencia numeric(12,2),
  quantidade numeric(10,2) not null default 1,
  observacoes text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint oportunidade_itens_oportunidade_empresa_fkey foreign key (oportunidade_id,empresa_id) references public.oportunidades(id,empresa_id) on delete cascade,
  constraint oportunidade_itens_tipo_check check (tipo in ('KIT','ITEM_ESTOQUE')),
  constraint oportunidade_itens_referencia_check check ((tipo='KIT' and kit_id is not null and estoque_item_id is null) or (tipo='ITEM_ESTOQUE' and estoque_item_id is not null and kit_id is null)),
  constraint oportunidade_itens_nome_snapshot_check check (char_length(trim(nome_snapshot)) between 2 and 300),
  constraint oportunidade_itens_valor_referencia_check check (valor_referencia is null or valor_referencia >= 0),
  constraint oportunidade_itens_quantidade_check check (quantidade > 0),
  constraint oportunidade_itens_ordem_check check (ordem >= 0)
);

create index if not exists oportunidade_itens_empresa_oportunidade_ordem_idx on public.oportunidade_itens (empresa_id,oportunidade_id,ordem,created_at);
create index if not exists oportunidade_itens_kit_idx on public.oportunidade_itens (kit_id) where kit_id is not null;
create index if not exists oportunidade_itens_estoque_item_idx on public.oportunidade_itens (estoque_item_id) where estoque_item_id is not null;

create or replace function public.atualizar_oportunidade_item_timestamp() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at:=now(); return new; end; $$;
drop trigger if exists atualizar_oportunidade_item_timestamp on public.oportunidade_itens;
create trigger atualizar_oportunidade_item_timestamp before update on public.oportunidade_itens for each row execute function public.atualizar_oportunidade_item_timestamp();

create or replace function public.usuario_tem_perfil_na_empresa(p_empresa_id uuid,p_perfis text[]) returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and p_empresa_id is not null and exists (
    select 1 from public.usuarios_empresa vinculo
    where vinculo.usuario_id=(select auth.uid()) and vinculo.empresa_id=p_empresa_id and vinculo.ativo=true
      and (vinculo.perfil='Administrador' or vinculo.perfil=any(coalesce(p_perfis,array[]::text[])))
  );
$$;
revoke all on function public.usuario_tem_perfil_na_empresa(uuid,text[]) from public,anon,authenticated,service_role;
grant execute on function public.usuario_tem_perfil_na_empresa(uuid,text[]) to authenticated;

alter table public.oportunidade_itens enable row level security;
drop policy if exists rbac_oportunidade_itens_comercial on public.oportunidade_itens;
drop policy if exists rbac_oportunidades_comercial on public.oportunidades;
create policy rbac_oportunidades_comercial on public.oportunidades for all to authenticated
using ((select public.usuario_tem_perfil_na_empresa(oportunidades.empresa_id,array['Comercial'])))
with check ((select public.usuario_tem_perfil_na_empresa(oportunidades.empresa_id,array['Comercial'])));

drop policy if exists rbac_oportunidade_historico_comercial on public.oportunidade_historico;
create policy rbac_oportunidade_historico_comercial on public.oportunidade_historico for select to authenticated
using (exists (select 1 from public.oportunidades oportunidade where oportunidade.id=oportunidade_historico.oportunidade_id and (select public.usuario_tem_perfil_na_empresa(oportunidade.empresa_id,array['Comercial']))));

drop policy if exists rbac_orcamentos_comercial on public.orcamentos;
create policy rbac_orcamentos_comercial on public.orcamentos for all to authenticated
using ((select public.usuario_tem_perfil_na_empresa(orcamentos.empresa_id,array['Comercial'])))
with check ((select public.usuario_tem_perfil_na_empresa(orcamentos.empresa_id,array['Comercial'])));

drop policy if exists rbac_orcamento_itens_comercial on public.orcamento_itens;
create policy rbac_orcamento_itens_comercial on public.orcamento_itens for all to authenticated
using (exists (select 1 from public.orcamentos orcamento where orcamento.id=orcamento_itens.orcamento_id and (select public.usuario_tem_perfil_na_empresa(orcamento.empresa_id,array['Comercial']))))
with check (exists (select 1 from public.orcamentos orcamento where orcamento.id=orcamento_itens.orcamento_id and (select public.usuario_tem_perfil_na_empresa(orcamento.empresa_id,array['Comercial']))));

create policy rbac_oportunidade_itens_comercial on public.oportunidade_itens for all to authenticated
using ((select public.usuario_tem_perfil_na_empresa(oportunidade_itens.empresa_id,array['Comercial'])))
with check ((select public.usuario_tem_perfil_na_empresa(oportunidade_itens.empresa_id,array['Comercial'])));

grant select,insert,update,delete on public.oportunidade_itens to authenticated;
revoke all on function public.atualizar_oportunidade_item_timestamp() from public,anon,authenticated,service_role;
drop trigger if exists auditar_operacao on public.oportunidade_itens;
create trigger auditar_operacao after insert or update or delete on public.oportunidade_itens for each row execute function public.auditar_entidade_operacional();
