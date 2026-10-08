-- Jornada Simplificada 3.0 — núcleo compatível do Orçamento 3.0.
--
-- Esta migration é estritamente aditiva: mantém as colunas e os estados
-- legados enquanto disponibiliza preço-base, preço negociado, descontos,
-- taxas estruturadas e itens conceituais. Nenhum item conceitual participa
-- do estoque; a futura incorporação será uma ação explícita e separada.

-- ---------------------------------------------------------------------------
-- 1. Orçamento canônico e contato preliminar
-- ---------------------------------------------------------------------------

alter table public.orcamentos
  add column if not exists origem text not null default 'MANUAL',
  add column if not exists contato_nome text,
  add column if not exists contato_telefone text,
  add column if not exists contato_email text,
  add column if not exists tema_evento text,
  add column if not exists desconto_tipo text not null default 'VALOR',
  add column if not exists desconto_valor numeric(12, 2) not null default 0,
  add column if not exists total_taxas numeric(12, 2) not null default 0;

update public.orcamentos orcamento
set
  origem = case
    when upper(coalesce(oportunidade.origem, '')) in (
      'SITE', 'MANUAL', 'WHATSAPP', 'INSTAGRAM', 'TELEFONE', 'INDICACAO', 'OUTRO'
    ) then upper(oportunidade.origem)
    when oportunidade.id is not null then 'OUTRO'
    else coalesce(nullif(orcamento.origem, ''), 'MANUAL')
  end,
  contato_nome = coalesce(
    nullif(orcamento.contato_nome, ''),
    nullif(oportunidade.nome_contato, '')
  ),
  contato_telefone = coalesce(
    nullif(orcamento.contato_telefone, ''),
    nullif(oportunidade.celular, '')
  ),
  contato_email = coalesce(
    nullif(orcamento.contato_email, ''),
    nullif(oportunidade.email, '')
  ),
  tema_evento = coalesce(
    nullif(orcamento.tema_evento, ''),
    nullif(oportunidade.interesse, '')
  ),
  desconto_tipo = 'VALOR',
  desconto_valor = greatest(coalesce(orcamento.desconto, 0), 0)
from public.oportunidades oportunidade
where oportunidade.id = orcamento.oportunidade_id;

update public.orcamentos orcamento
set
  contato_nome = coalesce(nullif(orcamento.contato_nome, ''), nullif(cliente.nome, '')),
  contato_telefone = coalesce(nullif(orcamento.contato_telefone, ''), nullif(cliente.whatsapp, '')),
  contato_email = coalesce(nullif(orcamento.contato_email, ''), nullif(cliente.email, '')),
  desconto_tipo = 'VALOR',
  desconto_valor = greatest(coalesce(orcamento.desconto, 0), 0)
from public.clientes cliente
where cliente.id = orcamento.cliente_id
;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamentos'::regclass
      and conname = 'orcamentos_origem_jornada3_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_origem_jornada3_check
      check (origem in (
        'SITE', 'MANUAL', 'WHATSAPP', 'INSTAGRAM', 'TELEFONE', 'INDICACAO', 'OUTRO'
      )) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamentos'::regclass
      and conname = 'orcamentos_desconto_tipo_jornada3_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_desconto_tipo_jornada3_check
      check (desconto_tipo in ('VALOR', 'PERCENTUAL')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamentos'::regclass
      and conname = 'orcamentos_desconto_valor_jornada3_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_desconto_valor_jornada3_check
      check (
        desconto_valor >= 0
        and (desconto_tipo <> 'PERCENTUAL' or desconto_valor <= 100)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamentos'::regclass
      and conname = 'orcamentos_total_taxas_jornada3_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_total_taxas_jornada3_check
      check (total_taxas >= 0) not valid;
  end if;
end $$;

alter table public.orcamentos
  validate constraint orcamentos_origem_jornada3_check;
alter table public.orcamentos
  validate constraint orcamentos_desconto_tipo_jornada3_check;
alter table public.orcamentos
  validate constraint orcamentos_desconto_valor_jornada3_check;
alter table public.orcamentos
  validate constraint orcamentos_total_taxas_jornada3_check;

-- Mantém o estado legado aceito e acrescenta os estados da Jornada 3.
alter table public.orcamentos
  drop constraint if exists orcamentos_status_check;

alter table public.orcamentos
  add constraint orcamentos_status_check
  check (status in (
    'Rascunho', 'Enviado', 'Aprovado', 'Recusado', 'Expirado',
    'RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA', 'EXPIRADA', 'CANCELADA',
    'NOVO', 'EM_EDICAO', 'FINALIZADO', 'CANCELADO'
  )) not valid;

alter table public.orcamentos validate constraint orcamentos_status_check;

alter table public.orcamentos
  drop constraint if exists orcamentos_formalizacao_status_check;

alter table public.orcamentos
  add constraint orcamentos_formalizacao_status_check
  check (
    formalizacao_status is null
    or formalizacao_status in (
      'Aguardando formalização', 'Aguardando contrato', 'Aguardando sinal',
      'Venda confirmada', 'Cancelada',
      'AGUARDANDO_DADOS', 'DADOS_COMPLETOS',
      'AGUARDANDO_CLIENTE', 'CLIENTE_CADASTRADO',
      'CONTRATO_GERADO', 'CONTRATO_ENVIADO', 'AGUARDANDO_ASSINATURA',
      'AGUARDANDO_PAGAMENTO', 'PRONTA_PARA_CONFIRMAR',
      'PRONTO_PARA_CONFIRMAR', 'RESERVA_CONFIRMADA', 'CANCELADA'
    )
  ) not valid;

alter table public.orcamentos
  validate constraint orcamentos_formalizacao_status_check;

create index if not exists orcamentos_empresa_origem_criacao_jornada3_idx
  on public.orcamentos (empresa_id, origem, created_at desc);

create index if not exists orcamentos_empresa_contato_telefone_jornada3_idx
  on public.orcamentos (empresa_id, contato_telefone)
  where contato_telefone is not null;

create index if not exists orcamentos_empresa_contato_email_jornada3_idx
  on public.orcamentos (empresa_id, lower(contato_email))
  where contato_email is not null;

-- ---------------------------------------------------------------------------
-- 2. Item conceitual: intenção criativa, nunca disponibilidade de estoque
-- ---------------------------------------------------------------------------

create table if not exists public.itens_conceituais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  descricao text,
  referencia_visual text,
  imagem_ia_url text,
  categoria text,
  cor text,
  dimensoes_estimadas text,
  custo_estimado numeric(12, 2),
  preco_locacao_estimado numeric(12, 2),
  status text not null default 'RASCUNHO',
  origem text not null default 'MANUAL',
  convertido_item_estoque_id uuid references public.estoque_itens(id) on delete restrict,
  incorporado_por uuid references auth.users(id) on delete set null,
  incorporado_em timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itens_conceituais_nome_check check (length(trim(nome)) > 0),
  constraint itens_conceituais_valores_check check (
    coalesce(custo_estimado, 0) >= 0
    and coalesce(preco_locacao_estimado, 0) >= 0
  ),
  constraint itens_conceituais_status_check check (status in (
    'RASCUNHO', 'PROPOSTO', 'APROVADO', 'COMPRAR', 'COMPRADO',
    'INCORPORADO_ESTOQUE', 'DESCARTADO'
  )),
  constraint itens_conceituais_origem_check check (origem in ('MANUAL', 'IA')),
  constraint itens_conceituais_incorporacao_check check (
    (status = 'INCORPORADO_ESTOQUE'
      and convertido_item_estoque_id is not null
      and incorporado_em is not null)
    or
    (status <> 'INCORPORADO_ESTOQUE'
      and convertido_item_estoque_id is null
      and incorporado_em is null)
  )
);

create unique index if not exists itens_conceituais_estoque_convertido_unique
  on public.itens_conceituais (convertido_item_estoque_id)
  where convertido_item_estoque_id is not null;

create index if not exists itens_conceituais_empresa_status_idx
  on public.itens_conceituais (empresa_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Itens do orçamento com preço-base e preço negociado independentes
-- ---------------------------------------------------------------------------

alter table public.orcamento_itens
  add column if not exists item_conceitual_id uuid,
  add column if not exists tipo_origem text,
  add column if not exists preco_base numeric(12, 2),
  add column if not exists preco_unitario_orcamento numeric(12, 2),
  add column if not exists desconto numeric(12, 2) not null default 0,
  add column if not exists observacao text,
  add column if not exists ordem integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamento_itens'::regclass
      and conname = 'orcamento_itens_item_conceitual_id_fkey'
  ) then
    alter table public.orcamento_itens
      add constraint orcamento_itens_item_conceitual_id_fkey
      foreign key (item_conceitual_id)
      references public.itens_conceituais(id)
      on delete restrict;
  end if;
end $$;

update public.orcamento_itens
set
  tipo_origem = case
    when kit_id is not null then 'KIT'
    when estoque_item_id is not null then 'ESTOQUE'
    else 'LIVRE'
  end,
  preco_base = greatest(coalesce(preco_base, valor_unitario, 0), 0),
  preco_unitario_orcamento = greatest(
    coalesce(preco_unitario_orcamento, valor_unitario, 0),
    0
  );

alter table public.orcamento_itens
  alter column tipo_origem set default 'LIVRE',
  alter column tipo_origem set not null,
  alter column preco_base set default 0,
  alter column preco_base set not null,
  alter column preco_unitario_orcamento set default 0,
  alter column preco_unitario_orcamento set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamento_itens'::regclass
      and conname = 'orcamento_itens_tipo_origem_jornada3_check'
  ) then
    alter table public.orcamento_itens
      add constraint orcamento_itens_tipo_origem_jornada3_check
      check (
        (tipo_origem = 'KIT'
          and kit_id is not null
          and estoque_item_id is null
          and item_conceitual_id is null)
        or
        (tipo_origem = 'ESTOQUE'
          and estoque_item_id is not null
          and kit_id is null
          and item_conceitual_id is null)
        or
        (tipo_origem = 'CONCEITUAL'
          and item_conceitual_id is not null
          and kit_id is null
          and estoque_item_id is null)
        or
        (tipo_origem = 'LIVRE'
          and kit_id is null
          and estoque_item_id is null
          and item_conceitual_id is null)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orcamento_itens'::regclass
      and conname = 'orcamento_itens_precos_jornada3_check'
  ) then
    alter table public.orcamento_itens
      add constraint orcamento_itens_precos_jornada3_check
      check (
        preco_base >= 0
        and preco_unitario_orcamento >= 0
        and desconto >= 0
        and desconto <= quantidade * preco_unitario_orcamento
      ) not valid;
  end if;
end $$;

alter table public.orcamento_itens
  validate constraint orcamento_itens_tipo_origem_jornada3_check;
alter table public.orcamento_itens
  validate constraint orcamento_itens_precos_jornada3_check;

alter table public.orcamento_itens
  add column if not exists subtotal_negociado numeric(12, 2)
  generated always as (
    greatest(quantidade * preco_unitario_orcamento - desconto, 0)
  ) stored;

create index if not exists orcamento_itens_conceitual_idx
  on public.orcamento_itens (item_conceitual_id)
  where item_conceitual_id is not null;

create index if not exists orcamento_itens_orcamento_ordem_jornada3_idx
  on public.orcamento_itens (orcamento_id, ordem, created_at);

create or replace function public.sincronizar_orcamento_item_jornada3()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_empresa_orcamento uuid;
  v_empresa_conceitual uuid;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.preco_unitario_orcamento, 0) = 0
      and coalesce(new.valor_unitario, 0) <> 0 then
      new.preco_unitario_orcamento := greatest(new.valor_unitario, 0);
    else
      new.preco_unitario_orcamento := greatest(
        coalesce(new.preco_unitario_orcamento, 0),
        0
      );
    end if;
    new.valor_unitario := new.preco_unitario_orcamento;
    if coalesce(new.preco_base, 0) = 0 then
      new.preco_base := new.preco_unitario_orcamento;
    else
      new.preco_base := greatest(new.preco_base, 0);
    end if;
  elsif new.preco_unitario_orcamento is distinct from old.preco_unitario_orcamento then
    new.valor_unitario := greatest(coalesce(new.preco_unitario_orcamento, 0), 0);
  elsif new.valor_unitario is distinct from old.valor_unitario then
    new.preco_unitario_orcamento := greatest(coalesce(new.valor_unitario, 0), 0);
  end if;

  if new.item_conceitual_id is not null then
    select empresa_id into v_empresa_orcamento
    from public.orcamentos
    where id = new.orcamento_id;

    select empresa_id into v_empresa_conceitual
    from public.itens_conceituais
    where id = new.item_conceitual_id;

    if v_empresa_conceitual is null
      or v_empresa_orcamento is null
      or v_empresa_conceitual <> v_empresa_orcamento then
      raise exception 'Item conceitual e orçamento devem pertencer à mesma empresa.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sincronizar_orcamento_item_jornada3
  on public.orcamento_itens;

create trigger sincronizar_orcamento_item_jornada3
before insert or update on public.orcamento_itens
for each row execute function public.sincronizar_orcamento_item_jornada3();

-- ---------------------------------------------------------------------------
-- 4. Taxas estruturadas e totalização compatível com o legado
-- ---------------------------------------------------------------------------

create table if not exists public.orcamento_taxas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  descricao text not null,
  valor numeric(12, 2) not null default 0,
  tipo text not null default 'OUTRA',
  observacao text,
  ordem integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orcamento_taxas_descricao_check check (length(trim(descricao)) > 0),
  constraint orcamento_taxas_valor_check check (valor >= 0),
  constraint orcamento_taxas_tipo_check check (tipo in (
    'ENTREGA', 'RETIRADA', 'MONTAGEM', 'DESMONTAGEM',
    'TRANSPORTE', 'DESLOCAMENTO', 'EXTRA', 'OUTRA'
  ))
);

create index if not exists orcamento_taxas_orcamento_ordem_idx
  on public.orcamento_taxas (orcamento_id, ordem, created_at);

create index if not exists orcamento_taxas_empresa_idx
  on public.orcamento_taxas (empresa_id, created_at desc);

create or replace function public.validar_empresa_orcamento_taxa_jornada3()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id
    into v_empresa_id
  from public.orcamentos
  where id = new.orcamento_id;

  if v_empresa_id is null then
    raise exception 'Orçamento sem empresa não pode receber taxa estruturada.';
  end if;

  if new.empresa_id is not null and new.empresa_id <> v_empresa_id then
    raise exception 'A taxa e o orçamento devem pertencer à mesma empresa.';
  end if;

  new.empresa_id := v_empresa_id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validar_empresa_orcamento_taxa_jornada3
  on public.orcamento_taxas;

create trigger validar_empresa_orcamento_taxa_jornada3
before insert or update on public.orcamento_taxas
for each row execute function public.validar_empresa_orcamento_taxa_jornada3();

create or replace function public.calcular_total_orcamento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_desconto_calculado numeric(12, 2);
begin
  new.subtotal := greatest(coalesce(new.subtotal, 0), 0);
  new.acrescimos := greatest(coalesce(new.acrescimos, 0), 0);
  new.frete := greatest(coalesce(new.frete, 0), 0);
  new.total_taxas := greatest(coalesce(new.total_taxas, 0), 0);

  if tg_op = 'UPDATE'
    and new.desconto is distinct from old.desconto
    and new.desconto_tipo is not distinct from old.desconto_tipo
    and new.desconto_valor is not distinct from old.desconto_valor then
    new.desconto_tipo := 'VALOR';
    new.desconto_valor := greatest(coalesce(new.desconto, 0), 0);
  end if;

  new.desconto_valor := greatest(coalesce(new.desconto_valor, 0), 0);
  v_desconto_calculado := case new.desconto_tipo
    when 'PERCENTUAL' then round(new.subtotal * new.desconto_valor / 100, 2)
    else new.desconto_valor
  end;

  new.desconto := least(v_desconto_calculado, new.subtotal);
  new.total := greatest(
    new.subtotal
      - new.desconto
      + new.acrescimos
      + new.frete
      + new.total_taxas,
    0
  );
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.recalcular_orcamento_por_itens()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento_id uuid;
begin
  v_orcamento_id := case when tg_op = 'DELETE'
    then old.orcamento_id
    else new.orcamento_id
  end;

  update public.orcamentos
  set subtotal = coalesce((
    select sum(item.subtotal_negociado)
    from public.orcamento_itens item
    where item.orcamento_id = v_orcamento_id
  ), 0)
  where id = v_orcamento_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.recalcular_orcamento_por_taxas_jornada3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento_id uuid;
begin
  v_orcamento_id := case when tg_op = 'DELETE'
    then old.orcamento_id
    else new.orcamento_id
  end;

  update public.orcamentos
  set total_taxas = coalesce((
    select sum(taxa.valor)
    from public.orcamento_taxas taxa
    where taxa.orcamento_id = v_orcamento_id
  ), 0)
  where id = v_orcamento_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists recalcular_orcamento_por_taxas_jornada3
  on public.orcamento_taxas;

create trigger recalcular_orcamento_por_taxas_jornada3
after insert or update or delete on public.orcamento_taxas
for each row execute function public.recalcular_orcamento_por_taxas_jornada3();

-- ---------------------------------------------------------------------------
-- 5. RLS, privilégios e auditoria
-- ---------------------------------------------------------------------------

alter table public.itens_conceituais enable row level security;
alter table public.orcamento_taxas enable row level security;

drop policy if exists rbac_itens_conceituais_comercial
  on public.itens_conceituais;

create policy rbac_itens_conceituais_comercial
on public.itens_conceituais
for all to authenticated
using (
  (select public.usuario_tem_perfil_na_empresa(
    itens_conceituais.empresa_id,
    array['Comercial']
  ))
)
with check (
  (select public.usuario_tem_perfil_na_empresa(
    itens_conceituais.empresa_id,
    array['Comercial']
  ))
);

drop policy if exists rbac_orcamento_taxas_comercial
  on public.orcamento_taxas;

create policy rbac_orcamento_taxas_comercial
on public.orcamento_taxas
for all to authenticated
using (
  exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.id = orcamento_taxas.orcamento_id
      and orcamento.empresa_id = orcamento_taxas.empresa_id
      and (select public.usuario_tem_perfil_na_empresa(
        orcamento.empresa_id,
        array['Comercial']
      ))
  )
)
with check (
  exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.id = orcamento_taxas.orcamento_id
      and orcamento.empresa_id = orcamento_taxas.empresa_id
      and (select public.usuario_tem_perfil_na_empresa(
        orcamento.empresa_id,
        array['Comercial']
      ))
  )
);

grant select, insert, update, delete
  on public.itens_conceituais, public.orcamento_taxas
  to authenticated;

revoke all on public.itens_conceituais, public.orcamento_taxas from anon;

drop trigger if exists auditar_operacao on public.itens_conceituais;
create trigger auditar_operacao
after insert or update or delete on public.itens_conceituais
for each row execute function public.auditar_entidade_operacional();

drop trigger if exists auditar_operacao on public.orcamento_taxas;
create trigger auditar_operacao
after insert or update or delete on public.orcamento_taxas
for each row execute function public.auditar_entidade_operacional();

revoke all on function public.sincronizar_orcamento_item_jornada3()
  from public, anon, authenticated, service_role;
revoke all on function public.validar_empresa_orcamento_taxa_jornada3()
  from public, anon, authenticated, service_role;
revoke all on function public.calcular_total_orcamento()
  from public, anon, authenticated, service_role;
revoke all on function public.recalcular_orcamento_por_itens()
  from public, anon, authenticated, service_role;
revoke all on function public.recalcular_orcamento_por_taxas_jornada3()
  from public, anon, authenticated, service_role;
