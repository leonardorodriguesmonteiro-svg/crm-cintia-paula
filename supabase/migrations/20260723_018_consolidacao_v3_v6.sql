-- Consolida os dados e regras da V3 no modelo canônico da V6.
-- A migração é idempotente e mantém as tabelas legadas como cópia de segurança.

create table if not exists public.consolidacao_estoque_v3_v6 (
  estoque_v3_id uuid primary key,
  estoque_v6_id uuid not null unique references public.estoque_itens(id),
  criado_em timestamptz not null default now()
);

alter table public.consolidacao_estoque_v3_v6 enable row level security;

create or replace function public.sincronizar_quantidades_estoque_v6()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.quantidade_total := greatest(coalesce(new.quantidade_total, 0), 0);
  new.quantidade_manutencao := greatest(coalesce(new.quantidade_manutencao, 0), 0);

  if new.quantidade_manutencao > new.quantidade_total then
    raise exception 'A quantidade em manutenção não pode ser maior que a quantidade total.';
  end if;

  new.quantidade_disponivel := new.quantidade_total - new.quantidade_manutencao;
  return new;
end;
$$;

drop trigger if exists sincronizar_quantidades_estoque_v6 on public.estoque_itens;
create trigger sincronizar_quantidades_estoque_v6
before insert or update of quantidade_total, quantidade_manutencao, quantidade_disponivel
on public.estoque_itens
for each row execute function public.sincronizar_quantidades_estoque_v6();

do $$
declare
  v_legado record;
  v_destino uuid;
begin
  if to_regclass('public.estoque') is null then
    return;
  end if;

  for v_legado in
    select e.*
    from public.estoque e
    left join public.consolidacao_estoque_v3_v6 mapa
      on mapa.estoque_v3_id = e.id
    where mapa.estoque_v3_id is null
  loop
    select id
    into v_destino
    from public.estoque_itens
    where lower(trim(coalesce(codigo, ''))) = lower(trim(coalesce(v_legado.codigo, '')))
      and trim(coalesce(v_legado.codigo, '')) <> ''
    limit 1;

    if v_destino is null then
      insert into public.estoque_itens (
        codigo, nome, categoria, cor, quantidade_total,
        quantidade_manutencao, valor_reposicao, foto_url, status
      ) values (
        trim(v_legado.codigo),
        v_legado.item,
        v_legado.categoria,
        v_legado.cor,
        greatest(coalesce(v_legado.quantidade_total, 0), 0),
        greatest(coalesce(v_legado.quantidade_manutencao, 0), 0),
        coalesce(v_legado.valor_reposicao, 0),
        v_legado.foto_url,
        case v_legado.status
          when 'Ativo' then 'Disponível'
          when 'Manutenção' then 'Manutenção'
          when 'Inativo' then 'Inativo'
          else coalesce(v_legado.status, 'Disponível')
        end
      )
      returning id into v_destino;
    else
      update public.estoque_itens
      set
        nome = coalesce(nullif(nome, ''), v_legado.item),
        categoria = coalesce(categoria, v_legado.categoria),
        cor = coalesce(cor, v_legado.cor),
        quantidade_total = greatest(
          coalesce(quantidade_total, 0),
          coalesce(v_legado.quantidade_total, 0)
        ),
        quantidade_manutencao = greatest(
          coalesce(quantidade_manutencao, 0),
          coalesce(v_legado.quantidade_manutencao, 0)
        ),
        valor_reposicao = greatest(
          coalesce(valor_reposicao, 0),
          coalesce(v_legado.valor_reposicao, 0)
        )
      where id = v_destino;
    end if;

    insert into public.consolidacao_estoque_v3_v6 (estoque_v3_id, estoque_v6_id)
    values (v_legado.id, v_destino)
    on conflict (estoque_v3_id) do update
    set estoque_v6_id = excluded.estoque_v6_id;
  end loop;
end $$;

insert into public.kit_composicao (
  kit_id, item_id, quantidade, observacoes
)
select
  legado.kit_id,
  legado.item_id,
  greatest(coalesce(legado.quantidade, 1), 1),
  legado.observacoes
from public.kit_itens legado
join public.estoque_itens item
  on item.id = legado.item_id
where legado.kit_id is not null
on conflict (kit_id, item_id) where kit_id is not null and item_id is not null
do update set
  quantidade = greatest(public.kit_composicao.quantidade, excluded.quantidade),
  observacoes = coalesce(public.kit_composicao.observacoes, excluded.observacoes);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'kit_itens'
      and column_name = 'estoque_id'
  ) then
    execute $sql$
      insert into public.kit_composicao (
        kit_id, item_id, quantidade, observacoes
      )
      select
        legado.kit_id,
        mapa.estoque_v6_id,
        greatest(coalesce(legado.quantidade, 1), 1),
        legado.observacoes
      from public.kit_itens legado
      join public.consolidacao_estoque_v3_v6 mapa
        on mapa.estoque_v3_id = legado.estoque_id
      where legado.kit_id is not null
      on conflict (kit_id, item_id) where kit_id is not null and item_id is not null
      do update set
        quantidade = greatest(public.kit_composicao.quantidade, excluded.quantidade),
        observacoes = coalesce(public.kit_composicao.observacoes, excluded.observacoes)
    $sql$;
  end if;
end $$;

create or replace function public.validar_composicao_kit_v6()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_disponivel integer;
begin
  if new.kit_id is null or new.item_id is null then
    raise exception 'Informe o kit e o item do estoque.';
  end if;

  if coalesce(new.quantidade, 0) <= 0 then
    raise exception 'A quantidade da composição deve ser maior que zero.';
  end if;

  select quantidade_disponivel
  into v_disponivel
  from public.estoque_itens
  where id = new.item_id;

  if v_disponivel is null then
    raise exception 'Item do estoque não encontrado.';
  end if;

  if new.quantidade > v_disponivel then
    raise exception 'A composição solicita % unidade(s), mas apenas % estão disponíveis no estoque.',
      new.quantidade, v_disponivel;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_composicao_kit_v6 on public.kit_composicao;
create trigger validar_composicao_kit_v6
before insert or update of kit_id, item_id, quantidade
on public.kit_composicao
for each row execute function public.validar_composicao_kit_v6();

alter table public.reservas
drop constraint if exists reservas_status_check;

update public.reservas
set
  status = case status
    when 'Reservado' then 'Confirmada'
    when 'Pago Parcial' then 'Confirmada'
    when 'Pago' then 'Confirmada'
    when 'Retirado' then 'Em andamento'
    when 'Devolvido' then 'Concluída'
    when 'Finalizado' then 'Concluída'
    when 'Cancelado' then 'Cancelada'
    else status
  end,
  status_comercial = case
    when status in ('Reservado', 'Pago Parcial', 'Pago', 'Retirado', 'Devolvido', 'Finalizado')
      then 'Confirmada'
    else coalesce(status_comercial, status)
  end,
  status_operacional = case status
    when 'Retirado' then 'Retirado'
    when 'Devolvido' then 'Devolvido'
    when 'Finalizado' then 'Finalizado'
    else coalesce(status_operacional, 'Aguardando operação')
  end
where status in (
  'Reservado',
  'Pago Parcial',
  'Pago',
  'Retirado',
  'Devolvido',
  'Finalizado',
  'Cancelado'
);

alter table public.reservas
add constraint reservas_status_check
check (status in (
  'Pendente',
  'Orçamento',
  'Confirmada',
  'Em andamento',
  'Concluída',
  'Cancelada'
));

create or replace function public.verificar_disponibilidade_kit(
  p_kit_id uuid,
  p_inicio date,
  p_fim date,
  p_reserva_ignorar uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflito text;
  v_capacidade integer;
  v_reservas_kit integer;
begin
  if p_inicio is null or p_fim is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Informe o período da reserva.');
  end if;

  if p_fim < p_inicio then
    return jsonb_build_object('disponivel', false, 'motivo', 'A data final não pode ser anterior à data inicial.');
  end if;

  select greatest(coalesce(quantidade, 1), 1)
  into v_capacidade
  from public.kits
  where id = p_kit_id;

  if v_capacidade is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Kit não encontrado.');
  end if;

  select count(*)
  into v_reservas_kit
  from public.reservas r
  where r.kit_id = p_kit_id
    and r.status in ('Confirmada', 'Em andamento')
    and (p_reserva_ignorar is null or r.id <> p_reserva_ignorar)
    and daterange(
      coalesce(r.data_retirada, r.data_evento, r.data_festa),
      coalesce(r.data_devolucao, r.data_evento, r.data_festa),
      '[]'
    ) && daterange(p_inicio, p_fim, '[]');

  if v_reservas_kit >= v_capacidade then
    return jsonb_build_object(
      'disponivel', false,
      'motivo', 'Todas as unidades deste kit já estão comprometidas no período.'
    );
  end if;

  select e.codigo || ' - ' || e.nome
  into v_conflito
  from public.kit_composicao solicitado
  join public.estoque_itens e on e.id = solicitado.item_id
  where solicitado.kit_id = p_kit_id
    and solicitado.quantidade + coalesce((
      select sum(alocado.quantidade)
      from public.reservas r
      join public.kit_composicao alocado on alocado.kit_id = r.kit_id
      where alocado.item_id = solicitado.item_id
        and r.status in ('Confirmada', 'Em andamento')
        and (p_reserva_ignorar is null or r.id <> p_reserva_ignorar)
        and daterange(
          coalesce(r.data_retirada, r.data_evento, r.data_festa),
          coalesce(r.data_devolucao, r.data_evento, r.data_festa),
          '[]'
        ) && daterange(p_inicio, p_fim, '[]')
    ), 0) > coalesce(e.quantidade_disponivel, 0)
  limit 1;

  if v_conflito is not null then
    return jsonb_build_object(
      'disponivel', false,
      'motivo', 'Estoque insuficiente no período para o item ' || v_conflito || '.'
    );
  end if;

  return jsonb_build_object('disponivel', true, 'motivo', 'Kit disponível no período.');
end;
$$;

create or replace function public.validar_disponibilidade_reserva()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if new.status in ('Confirmada', 'Em andamento') then
    v_resultado := public.verificar_disponibilidade_kit(
      new.kit_id,
      coalesce(new.data_retirada, new.data_evento, new.data_festa),
      coalesce(new.data_devolucao, new.data_evento, new.data_festa),
      new.id
    );

    if not (v_resultado->>'disponivel')::boolean then
      raise exception '%', v_resultado->>'motivo' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_disponibilidade_antes_reserva on public.reservas;
create trigger validar_disponibilidade_antes_reserva
before insert or update of kit_id, data_evento, data_festa, data_retirada, data_devolucao, status
on public.reservas
for each row execute function public.validar_disponibilidade_reserva();

revoke all on function public.verificar_disponibilidade_kit(uuid, date, date, uuid) from public;
grant execute on function public.verificar_disponibilidade_kit(uuid, date, date, uuid) to authenticated;

create table if not exists public.conferencias (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  tipo text not null check (tipo in ('Retirada', 'Devolução')),
  responsavel text,
  observacoes text,
  status text not null default 'Conforme' check (status in ('Conforme', 'Com Pendências')),
  conferido_em timestamptz not null default now(),
  unique (reserva_id, tipo)
);

create table if not exists public.conferencia_itens (
  id uuid primary key default gen_random_uuid(),
  conferencia_id uuid not null references public.conferencias(id) on delete cascade,
  item_id uuid references public.estoque_itens(id),
  quantidade_prevista integer not null default 0,
  quantidade_conferida integer not null default 0,
  quantidade_danificada integer not null default 0,
  quantidade_faltante integer not null default 0,
  observacoes text
);

create table if not exists public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.estoque_itens(id),
  conferencia_id uuid references public.conferencias(id) on delete set null,
  tipo text not null check (tipo in (
    'Avaria',
    'Reversão de avaria',
    'Extravio',
    'Reversão de extravio'
  )),
  quantidade integer not null check (quantidade > 0),
  saldo_total_antes integer not null,
  saldo_total_depois integer not null,
  saldo_manutencao_antes integer not null,
  saldo_manutencao_depois integer not null,
  observacoes text,
  criado_em timestamptz not null default now()
);

alter table public.conferencias enable row level security;
alter table public.conferencia_itens enable row level security;
alter table public.movimentos_estoque enable row level security;

drop policy if exists "authenticated_all_conferencias" on public.conferencias;
create policy "authenticated_all_conferencias" on public.conferencias
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_conferencia_itens" on public.conferencia_itens;
create policy "authenticated_all_conferencia_itens" on public.conferencia_itens
for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_all_movimentos_estoque" on public.movimentos_estoque;
create policy "authenticated_all_movimentos_estoque" on public.movimentos_estoque
for all to authenticated using (true) with check (true);

alter table public.conferencia_itens
add column if not exists item_id uuid references public.estoque_itens(id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'conferencia_itens'
      and column_name = 'estoque_id'
  ) then
    alter table public.conferencia_itens alter column estoque_id drop not null;

    update public.conferencia_itens ci
    set item_id = mapa.estoque_v6_id
    from public.consolidacao_estoque_v3_v6 mapa
    where ci.item_id is null
      and ci.estoque_id = mapa.estoque_v3_id;
  end if;
end $$;

create unique index if not exists conferencia_itens_conferencia_item_unique
on public.conferencia_itens(conferencia_id, item_id)
where item_id is not null;

alter table public.movimentos_estoque
add column if not exists item_id uuid references public.estoque_itens(id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'movimentos_estoque'
      and column_name = 'estoque_id'
  ) then
    alter table public.movimentos_estoque alter column estoque_id drop not null;

    update public.movimentos_estoque movimento
    set item_id = mapa.estoque_v6_id
    from public.consolidacao_estoque_v3_v6 mapa
    where movimento.item_id is null
      and movimento.estoque_id = mapa.estoque_v3_id;
  end if;
end $$;

create index if not exists movimentos_estoque_item_v6_data
on public.movimentos_estoque(item_id, criado_em desc);

create or replace function public.registrar_conferencia(
  p_reserva_id uuid,
  p_tipo text,
  p_responsavel text,
  p_observacoes text,
  p_itens jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conferencia_id uuid;
  v_kit_id uuid;
  v_status_reserva text;
  v_status_conferencia text;
  v_total_composicao integer;
  v_total_informado integer;
  v_ajuste record;
  v_total_antes integer;
  v_total_depois integer;
  v_manutencao_antes integer;
  v_manutencao_depois integer;
  v_delta_danificado integer;
  v_delta_faltante integer;
begin
  if p_tipo not in ('Retirada', 'Devolução') then
    raise exception 'Tipo de conferência inválido.';
  end if;

  if nullif(trim(coalesce(p_responsavel, '')), '') is null then
    raise exception 'Informe o responsável pela conferência.';
  end if;

  select kit_id, status
  into v_kit_id, v_status_reserva
  from public.reservas
  where id = p_reserva_id
  for update;

  if v_kit_id is null then
    raise exception 'Reserva ou kit da reserva não encontrado.';
  end if;

  select id
  into v_conferencia_id
  from public.conferencias
  where reserva_id = p_reserva_id
    and tipo = p_tipo;

  if p_tipo = 'Retirada' then
    if exists (
      select 1 from public.conferencias
      where reserva_id = p_reserva_id and tipo = 'Devolução'
    ) then
      raise exception 'A retirada não pode ser alterada depois da devolução.';
    end if;

    if v_conferencia_id is null and v_status_reserva <> 'Confirmada' then
      raise exception 'A reserva precisa estar confirmada para registrar a retirada.';
    end if;
  else
    if not exists (
      select 1 from public.conferencias
      where reserva_id = p_reserva_id and tipo = 'Retirada'
    ) then
      raise exception 'Registre a retirada antes da devolução.';
    end if;

    if v_conferencia_id is null and v_status_reserva <> 'Em andamento' then
      raise exception 'A reserva precisa estar em andamento para registrar a devolução.';
    end if;
  end if;

  select count(*)
  into v_total_composicao
  from public.kit_composicao
  where kit_id = v_kit_id;

  if v_total_composicao = 0 then
    raise exception 'O kit da reserva ainda não possui composição cadastrada.';
  end if;

  select count(*)
  into v_total_informado
  from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
    item_id uuid,
    quantidade_conferida integer,
    quantidade_danificada integer,
    observacoes text
  );

  if v_total_informado <> v_total_composicao then
    raise exception 'O checklist deve conter todos os itens da composição do kit.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
      item_id uuid,
      quantidade_conferida integer,
      quantidade_danificada integer,
      observacoes text
    )
    group by x.item_id
    having count(*) > 1
  ) then
    raise exception 'O checklist possui itens duplicados.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
      item_id uuid,
      quantidade_conferida integer,
      quantidade_danificada integer,
      observacoes text
    )
    left join public.kit_composicao kc
      on kc.kit_id = v_kit_id
     and kc.item_id = x.item_id
    where kc.id is null
       or coalesce(x.quantidade_conferida, 0) < 0
       or coalesce(x.quantidade_conferida, 0) > kc.quantidade
       or coalesce(x.quantidade_danificada, 0) < 0
       or coalesce(x.quantidade_danificada, 0) > coalesce(x.quantidade_conferida, 0)
  ) then
    raise exception 'O checklist contém quantidades inválidas ou itens fora da composição.';
  end if;

  select case when exists (
    select 1
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
      item_id uuid,
      quantidade_conferida integer,
      quantidade_danificada integer,
      observacoes text
    )
    join public.kit_composicao kc
      on kc.kit_id = v_kit_id
     and kc.item_id = x.item_id
    where coalesce(x.quantidade_danificada, 0) > 0
       or coalesce(x.quantidade_conferida, 0) < kc.quantidade
  ) then 'Com Pendências' else 'Conforme' end
  into v_status_conferencia;

  insert into public.conferencias (
    reserva_id, tipo, responsavel, observacoes, status, conferido_em
  ) values (
    p_reserva_id,
    p_tipo,
    trim(p_responsavel),
    nullif(trim(coalesce(p_observacoes, '')), ''),
    v_status_conferencia,
    now()
  )
  on conflict (reserva_id, tipo) do update set
    responsavel = excluded.responsavel,
    observacoes = excluded.observacoes,
    status = excluded.status,
    conferido_em = now()
  returning id into v_conferencia_id;

  if p_tipo = 'Devolução' then
    for v_ajuste in
      with novos as (
        select
          kc.item_id,
          greatest(coalesce(x.quantidade_danificada, 0), 0) as danificado,
          greatest(kc.quantidade - coalesce(x.quantidade_conferida, 0), 0) as faltante,
          nullif(trim(coalesce(x.observacoes, '')), '') as observacoes
        from public.kit_composicao kc
        join jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
          item_id uuid,
          quantidade_conferida integer,
          quantidade_danificada integer,
          observacoes text
        ) on x.item_id = kc.item_id
        where kc.kit_id = v_kit_id
      ),
      antigos as (
        select
          item_id,
          quantidade_danificada as danificado,
          quantidade_faltante as faltante
        from public.conferencia_itens
        where conferencia_id = v_conferencia_id
      )
      select
        coalesce(n.item_id, a.item_id) as item_id,
        coalesce(n.danificado, 0) - coalesce(a.danificado, 0) as delta_danificado,
        coalesce(n.faltante, 0) - coalesce(a.faltante, 0) as delta_faltante,
        n.observacoes
      from novos n
      full join antigos a using (item_id)
    loop
      v_delta_danificado := v_ajuste.delta_danificado;
      v_delta_faltante := v_ajuste.delta_faltante;

      if v_delta_danificado <> 0 or v_delta_faltante <> 0 then
        select
          coalesce(quantidade_total, 0),
          coalesce(quantidade_manutencao, 0)
        into v_total_antes, v_manutencao_antes
        from public.estoque_itens
        where id = v_ajuste.item_id
        for update;

        v_total_depois := v_total_antes - v_delta_faltante;
        v_manutencao_depois := v_manutencao_antes + v_delta_danificado;

        if v_total_depois < 0 then
          raise exception 'A baixa deixaria o estoque do item com quantidade negativa.';
        end if;

        if v_manutencao_depois < 0 or v_manutencao_depois > v_total_depois then
          raise exception 'A avaria informada é incompatível com o saldo atual do estoque.';
        end if;

        if v_delta_faltante <> 0 then
          update public.estoque_itens
          set quantidade_total = v_total_depois
          where id = v_ajuste.item_id;

          insert into public.movimentos_estoque (
            item_id, conferencia_id, tipo, quantidade,
            saldo_total_antes, saldo_total_depois,
            saldo_manutencao_antes, saldo_manutencao_depois, observacoes
          ) values (
            v_ajuste.item_id,
            v_conferencia_id,
            case when v_delta_faltante > 0 then 'Extravio' else 'Reversão de extravio' end,
            abs(v_delta_faltante),
            v_total_antes,
            v_total_depois,
            v_manutencao_antes,
            v_manutencao_antes,
            v_ajuste.observacoes
          );

          v_total_antes := v_total_depois;
        end if;

        if v_delta_danificado <> 0 then
          update public.estoque_itens
          set quantidade_manutencao = v_manutencao_depois
          where id = v_ajuste.item_id;

          insert into public.movimentos_estoque (
            item_id, conferencia_id, tipo, quantidade,
            saldo_total_antes, saldo_total_depois,
            saldo_manutencao_antes, saldo_manutencao_depois, observacoes
          ) values (
            v_ajuste.item_id,
            v_conferencia_id,
            case when v_delta_danificado > 0 then 'Avaria' else 'Reversão de avaria' end,
            abs(v_delta_danificado),
            v_total_antes,
            v_total_antes,
            v_manutencao_antes,
            v_manutencao_depois,
            v_ajuste.observacoes
          );
        end if;
      end if;
    end loop;
  end if;

  delete from public.conferencia_itens
  where conferencia_id = v_conferencia_id;

  insert into public.conferencia_itens (
    conferencia_id, item_id, quantidade_prevista, quantidade_conferida,
    quantidade_danificada, quantidade_faltante, observacoes
  )
  select
    v_conferencia_id,
    kc.item_id,
    kc.quantidade,
    greatest(coalesce(x.quantidade_conferida, 0), 0),
    greatest(coalesce(x.quantidade_danificada, 0), 0),
    greatest(kc.quantidade - coalesce(x.quantidade_conferida, 0), 0),
    nullif(trim(coalesce(x.observacoes, '')), '')
  from public.kit_composicao kc
  join jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
    item_id uuid,
    quantidade_conferida integer,
    quantidade_danificada integer,
    observacoes text
  ) on x.item_id = kc.item_id
  where kc.kit_id = v_kit_id;

  update public.reservas
  set
    status = case when p_tipo = 'Retirada' then 'Em andamento' else 'Concluída' end,
    status_operacional = case when p_tipo = 'Retirada' then 'Retirado' else 'Devolvido' end
  where id = p_reserva_id;

  insert into public.reserva_timeline (
    reserva_id, titulo, descricao, tipo
  ) values (
    p_reserva_id,
    case when p_tipo = 'Retirada' then 'Retirada conferida' else 'Devolução conferida' end,
    case
      when v_status_conferencia = 'Conforme' then 'Todos os itens foram conferidos.'
      else 'A conferência foi salva com pendências de estoque.'
    end,
    'Conferência'
  );

  return v_conferencia_id;
end;
$$;

revoke all on function public.registrar_conferencia(uuid, text, text, text, jsonb) from public;
grant execute on function public.registrar_conferencia(uuid, text, text, text, jsonb) to authenticated;
