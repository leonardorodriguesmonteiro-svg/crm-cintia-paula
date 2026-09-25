-- Sprint Comercial 1.1 - Valores e desconto na analise da pre-reserva.
-- Evolucao aditiva: preserva historico e preenche somente precos ausentes.

alter table public.oportunidades
  add column if not exists desconto_tipo text not null default 'VALOR',
  add column if not exists desconto_valor numeric(12, 2) not null default 0,
  add column if not exists desconto_calculado numeric(12, 2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.oportunidades'::regclass
      and conname = 'oportunidades_desconto_tipo_check'
  ) then
    alter table public.oportunidades
      add constraint oportunidades_desconto_tipo_check
      check (desconto_tipo in ('VALOR', 'PERCENTUAL')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.oportunidades'::regclass
      and conname = 'oportunidades_desconto_valor_check'
  ) then
    alter table public.oportunidades
      add constraint oportunidades_desconto_valor_check
      check (desconto_valor >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.oportunidades'::regclass
      and conname = 'oportunidades_desconto_calculado_check'
  ) then
    alter table public.oportunidades
      add constraint oportunidades_desconto_calculado_check
      check (desconto_calculado >= 0) not valid;
  end if;
end $$;

alter table public.oportunidades
  validate constraint oportunidades_desconto_tipo_check;
alter table public.oportunidades
  validate constraint oportunidades_desconto_valor_check;
alter table public.oportunidades
  validate constraint oportunidades_desconto_calculado_check;

-- Todo item novo passa a registrar o preco vigente do catalogo no momento
-- da solicitacao, inclusive itens avulsos do estoque.
create or replace function public.preencher_valor_referencia_pre_reserva()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valor_referencia is not null then
    return new;
  end if;

  if new.tipo = 'KIT' and new.kit_id is not null then
    select greatest(kit.valor, 0)
      into new.valor_referencia
    from public.kits kit
    where kit.id = new.kit_id
      and kit.status is distinct from 'Inativo';
  elsif new.tipo = 'ITEM_ESTOQUE' and new.estoque_item_id is not null then
    select greatest(item.valor_locacao, 0)
      into new.valor_referencia
    from public.estoque_itens item
    where item.id = new.estoque_item_id
      and item.status is distinct from 'Inativo';
  end if;

  return new;
end;
$$;

drop trigger if exists oportunidade_itens_preencher_valor_referencia
  on public.oportunidade_itens;

create trigger oportunidade_itens_preencher_valor_referencia
before insert or update of tipo, kit_id, estoque_item_id, valor_referencia
on public.oportunidade_itens
for each row execute function public.preencher_valor_referencia_pre_reserva();

revoke all on function public.preencher_valor_referencia_pre_reserva()
  from public, anon, authenticated;

-- Corrige apenas snapshots historicos sem preco, mantendo qualquer valor
-- que ja tenha sido registrado anteriormente.
update public.oportunidade_itens item
set valor_referencia = case
  when item.tipo = 'KIT' then (
    select greatest(kit.valor, 0)
    from public.kits kit
    where kit.id = item.kit_id
  )
  when item.tipo = 'ITEM_ESTOQUE' then (
    select greatest(estoque.valor_locacao, 0)
    from public.estoque_itens estoque
    where estoque.id = item.estoque_item_id
  )
  else null
end,
updated_at = now()
where item.valor_referencia is null;

with totais as (
  select
    item.oportunidade_id,
    round(sum(item.quantidade * item.valor_referencia), 2) as subtotal
  from public.oportunidade_itens item
  where item.valor_referencia is not null
  group by item.oportunidade_id
)
update public.oportunidades oportunidade
set valor_estimado = total.subtotal,
    updated_at = now()
from totais total
where oportunidade.id = total.oportunidade_id
  and oportunidade.etapa in (
    'RECEBIDA', 'EM_ANALISE', 'AJUSTE_SOLICITADO',
    'APROVADA', 'CONVERTIDA_EM_PROPOSTA'
  )
  and coalesce(oportunidade.valor_estimado, 0) = 0;

create or replace function public.ajustar_valores_pre_reserva_servidor(
  p_empresa_id uuid,
  p_oportunidade_id uuid,
  p_usuario_id uuid,
  p_versao_esperada integer,
  p_desconto_tipo text,
  p_desconto_valor numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oportunidade public.oportunidades%rowtype;
  v_subtotal numeric(12, 2);
  v_desconto numeric(12, 2);
  v_total numeric(12, 2);
  v_itens_sem_preco integer;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Funcao exclusiva do servidor.';
  end if;

  if not exists (
    select 1
    from public.usuarios_empresa vinculo
    where vinculo.usuario_id = p_usuario_id
      and vinculo.empresa_id = p_empresa_id
      and vinculo.ativo = true
      and vinculo.perfil in ('Administrador', 'Comercial')
  ) then
    raise exception using errcode = '42501', message = 'Usuario sem permissao comercial nesta empresa.';
  end if;

  select * into v_oportunidade
  from public.oportunidades oportunidade
  where oportunidade.id = p_oportunidade_id
    and oportunidade.empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Pre-reserva nao encontrada.';
  end if;

  if v_oportunidade.versao <> p_versao_esperada then
    raise exception using errcode = '40001', message = 'A pre-reserva foi alterada por outro usuario. Atualize a tela.';
  end if;

  if v_oportunidade.etapa in ('RECUSADA', 'CONVERTIDA_EM_PROPOSTA') then
    raise exception using errcode = '23514', message = 'Esta pre-reserva nao permite mais ajustes comerciais.';
  end if;

  if p_desconto_tipo not in ('VALOR', 'PERCENTUAL') then
    raise exception using errcode = '22023', message = 'Tipo de desconto invalido.';
  end if;

  if p_desconto_valor is null or p_desconto_valor < 0
    or (p_desconto_tipo = 'PERCENTUAL' and p_desconto_valor > 100)
  then
    raise exception using errcode = '22023', message = 'Valor de desconto invalido.';
  end if;

  select
    round(coalesce(sum(item.quantidade * item.valor_referencia), 0), 2),
    count(*) filter (where item.valor_referencia is null)
  into v_subtotal, v_itens_sem_preco
  from public.oportunidade_itens item
  where item.oportunidade_id = p_oportunidade_id
    and item.empresa_id = p_empresa_id;

  if v_itens_sem_preco > 0 then
    raise exception using errcode = '23514', message = 'Existem itens sem preco de locacao cadastrado.';
  end if;

  v_desconto := case
    when p_desconto_tipo = 'PERCENTUAL'
      then round(v_subtotal * p_desconto_valor / 100, 2)
    else round(p_desconto_valor, 2)
  end;

  if v_desconto > v_subtotal then
    raise exception using errcode = '23514', message = 'O desconto nao pode ultrapassar o subtotal do pedido.';
  end if;

  v_total := greatest(v_subtotal - v_desconto, 0);
  perform set_config('app.usuario_id', p_usuario_id::text, true);

  update public.oportunidades
  set desconto_tipo = p_desconto_tipo,
      desconto_valor = round(p_desconto_valor, 2),
      desconto_calculado = v_desconto,
      valor_estimado = v_total,
      versao = versao + 1,
      updated_at = now()
  where id = p_oportunidade_id
  returning * into v_oportunidade;

  return jsonb_build_object(
    'id', v_oportunidade.id,
    'numero', v_oportunidade.numero,
    'status', v_oportunidade.etapa,
    'versao', v_oportunidade.versao,
    'subtotal', v_subtotal,
    'desconto_tipo', v_oportunidade.desconto_tipo,
    'desconto_valor', v_oportunidade.desconto_valor,
    'desconto_calculado', v_oportunidade.desconto_calculado,
    'total', v_oportunidade.valor_estimado
  );
end;
$$;

revoke all on function public.ajustar_valores_pre_reserva_servidor(
  uuid, uuid, uuid, integer, text, numeric
) from public, anon, authenticated;

grant execute on function public.ajustar_valores_pre_reserva_servidor(
  uuid, uuid, uuid, integer, text, numeric
) to service_role;
