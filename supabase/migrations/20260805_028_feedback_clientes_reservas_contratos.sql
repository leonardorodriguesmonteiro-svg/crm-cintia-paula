-- Oitava entrega: cadastro completo, preços compostos e reservas com múltiplos itens.

alter table public.clientes add column if not exists rg text;
alter table public.clientes add column if not exists cep text;
alter table public.clientes add column if not exists numero text;
alter table public.clientes add column if not exists complemento text;
alter table public.clientes add column if not exists estado text;

alter table public.kit_composicao
add column if not exists valor_ajuste numeric(12, 2) not null default 0;

alter table public.contratos add column if not exists email_enviado_em timestamptz;
alter table public.contratos add column if not exists email_destino text;
alter table public.contratos add column if not exists email_erro text;

create table if not exists public.reserva_itens (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  kit_id uuid references public.kits(id) on delete set null,
  descricao text not null,
  quantidade numeric(10, 2) not null default 1 check (quantidade > 0),
  valor_unitario numeric(12, 2) not null default 0,
  subtotal numeric(12, 2) generated always as (quantidade * valor_unitario) stored,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  constraint reserva_itens_kit_quantidade_check
    check (kit_id is null or quantidade = 1)
);

create index if not exists reserva_itens_reserva_idx
on public.reserva_itens(reserva_id, ordem, created_at);

create unique index if not exists reserva_itens_reserva_kit_unique
on public.reserva_itens(reserva_id, kit_id)
where kit_id is not null;

alter table public.reserva_itens enable row level security;

drop policy if exists "Usuários autenticados podem acessar itens da reserva"
on public.reserva_itens;

create policy "Usuários autenticados podem acessar itens da reserva"
on public.reserva_itens
for all to authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.reserva_itens to authenticated;

-- Primeiro preserva as linhas comerciais das reservas geradas por orçamento.
insert into public.reserva_itens (
  reserva_id, kit_id, descricao, quantidade, valor_unitario, ordem, created_at
)
select
  reserva.id,
  item.kit_id,
  item.descricao,
  case when item.kit_id is not null then 1 else item.quantidade end,
  case
    when item.kit_id is not null then item.subtotal
    else item.valor_unitario
  end,
  row_number() over (partition by reserva.id order by item.created_at)::integer,
  item.created_at
from public.reservas reserva
join public.orcamento_itens item on item.orcamento_id = reserva.orcamento_id
where not exists (
  select 1 from public.reserva_itens existente
  where existente.reserva_id = reserva.id
)
on conflict do nothing;

-- Reservas manuais antigas recebem a linha correspondente ao kit principal.
insert into public.reserva_itens (
  reserva_id, kit_id, descricao, quantidade, valor_unitario, ordem
)
select
  reserva.id,
  reserva.kit_id,
  kit.nome,
  1,
  reserva.valor_total,
  1
from public.reservas reserva
join public.kits kit on kit.id = reserva.kit_id
where not exists (
  select 1 from public.reserva_itens existente
  where existente.reserva_id = reserva.id
)
on conflict do nothing;

create or replace function public.recalcular_reserva_por_itens()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva_id uuid;
begin
  v_reserva_id := case when tg_op = 'DELETE' then old.reserva_id else new.reserva_id end;

  update public.reservas
  set valor_total = greatest(coalesce((
        select sum(item.subtotal)
        from public.reserva_itens item
        where item.reserva_id = v_reserva_id
      ), 0), 0),
      kit_id = coalesce((
        select item.kit_id
        from public.reserva_itens item
        where item.reserva_id = v_reserva_id
          and item.kit_id is not null
        order by item.ordem, item.created_at
        limit 1
      ), kit_id)
  where id = v_reserva_id;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists recalcular_reserva_por_itens on public.reserva_itens;
create trigger recalcular_reserva_por_itens
after insert or update or delete on public.reserva_itens
for each row execute function public.recalcular_reserva_por_itens();

revoke all on function public.recalcular_reserva_por_itens() from public;

-- A disponibilidade passa a considerar todos os kits vinculados à reserva.
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
  from public.reservas reserva
  where reserva.status in ('Confirmada', 'Em andamento')
    and (p_reserva_ignorar is null or reserva.id <> p_reserva_ignorar)
    and daterange(
      coalesce(reserva.data_retirada, reserva.data_evento, reserva.data_festa),
      coalesce(reserva.data_devolucao, reserva.data_evento, reserva.data_festa),
      '[]'
    ) && daterange(p_inicio, p_fim, '[]')
    and (
      exists (
        select 1 from public.reserva_itens item
        where item.reserva_id = reserva.id and item.kit_id = p_kit_id
      )
      or (
        not exists (
          select 1 from public.reserva_itens item
          where item.reserva_id = reserva.id and item.kit_id is not null
        )
        and reserva.kit_id = p_kit_id
      )
    );

  if v_reservas_kit >= v_capacidade then
    return jsonb_build_object(
      'disponivel', false,
      'motivo', 'Todas as unidades deste kit já estão comprometidas no período.'
    );
  end if;

  select estoque.codigo || ' - ' || estoque.nome
  into v_conflito
  from public.kit_composicao solicitado
  join public.estoque_itens estoque on estoque.id = solicitado.item_id
  where solicitado.kit_id = p_kit_id
    and solicitado.quantidade + coalesce((
      select sum(alocado.quantidade)
      from public.reservas reserva
      join public.reserva_itens item_reserva on item_reserva.reserva_id = reserva.id
      join public.kit_composicao alocado on alocado.kit_id = item_reserva.kit_id
      where alocado.item_id = solicitado.item_id
        and reserva.status in ('Confirmada', 'Em andamento')
        and (p_reserva_ignorar is null or reserva.id <> p_reserva_ignorar)
        and daterange(
          coalesce(reserva.data_retirada, reserva.data_evento, reserva.data_festa),
          coalesce(reserva.data_devolucao, reserva.data_evento, reserva.data_festa),
          '[]'
        ) && daterange(p_inicio, p_fim, '[]')
    ), 0) > coalesce(estoque.quantidade_disponivel, 0)
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

create or replace function public.validar_item_reserva()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_reserva public.reservas%rowtype;
  v_resultado jsonb;
begin
  if new.kit_id is null then return new; end if;

  select * into v_reserva
  from public.reservas
  where id = new.reserva_id;

  if v_reserva.status in ('Confirmada', 'Em andamento') then
    v_resultado := public.verificar_disponibilidade_kit(
      new.kit_id,
      coalesce(v_reserva.data_retirada, v_reserva.data_evento, v_reserva.data_festa),
      coalesce(v_reserva.data_devolucao, v_reserva.data_evento, v_reserva.data_festa),
      v_reserva.id
    );

    if not coalesce((v_resultado->>'disponivel')::boolean, false) then
      raise exception '%', v_resultado->>'motivo' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_item_reserva on public.reserva_itens;
create trigger validar_item_reserva
before insert or update of reserva_id, kit_id on public.reserva_itens
for each row execute function public.validar_item_reserva();

revoke all on function public.validar_item_reserva() from public;

-- Conversão de orçamento: remove a limitação de um único kit e copia todas as linhas.
create or replace function public.aprovar_orcamento_e_criar_reserva(
  p_orcamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_oportunidade public.oportunidades%rowtype;
  v_cliente_id uuid;
  v_kit_id uuid;
  v_total_kits integer;
  v_disponibilidade jsonb;
  v_reserva_id uuid;
  v_itens text;
  v_linha record;
  v_ordem integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente no ERP.';
  end if;

  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found then raise exception 'Orçamento não encontrado.'; end if;

  if v_orcamento.reserva_id is not null then
    return jsonb_build_object(
      'reserva_id', v_orcamento.reserva_id,
      'criada', false,
      'mensagem', 'Este orçamento já possui uma reserva.'
    );
  end if;

  select reserva.id into v_reserva_id
  from public.reservas reserva
  where reserva.orcamento_id = p_orcamento_id
  limit 1;

  if v_reserva_id is not null then
    update public.orcamentos
    set reserva_id = v_reserva_id, status = 'Aprovado'
    where id = p_orcamento_id;

    return jsonb_build_object(
      'reserva_id', v_reserva_id,
      'criada', false,
      'mensagem', 'A reserva existente foi vinculada ao orçamento.'
    );
  end if;

  v_cliente_id := v_orcamento.cliente_id;

  if v_cliente_id is null and v_orcamento.oportunidade_id is not null then
    select * into v_oportunidade
    from public.oportunidades
    where id = v_orcamento.oportunidade_id;

    if found then
      select cliente.id into v_cliente_id
      from public.clientes cliente
      where cliente.whatsapp = v_oportunidade.celular
      limit 1;

      if v_cliente_id is null then
        insert into public.clientes (
          nome, whatsapp, email, origem, status, observacoes
        ) values (
          v_oportunidade.nome_contato,
          v_oportunidade.celular,
          v_oportunidade.email,
          v_oportunidade.origem,
          'Cliente',
          'Cliente criado automaticamente na aprovação do orçamento.'
        ) returning id into v_cliente_id;
      end if;

      update public.oportunidades set cliente_id = v_cliente_id
      where id = v_oportunidade.id;
      update public.orcamentos set cliente_id = v_cliente_id
      where id = p_orcamento_id;
    end if;
  end if;

  if v_cliente_id is null then
    raise exception 'Não foi possível identificar o cliente deste orçamento.';
  end if;

  if v_orcamento.data_evento is null then
    raise exception 'Informe a data do evento antes de aprovar o orçamento.';
  end if;

  select count(*)::integer into v_total_kits
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id and item.kit_id is not null;

  if v_total_kits = 0 then
    raise exception 'Adicione um kit ao orçamento antes de gerar a reserva.';
  end if;

  if exists (
    select 1 from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id
      and item.kit_id is not null
      and item.quantidade <> 1
  ) then
    raise exception 'Cada kit deve ser incluído em uma linha individual da reserva.';
  end if;

  if exists (
    select 1
    from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id
      and item.kit_id is not null
    group by item.kit_id
    having count(*) > 1
  ) then
    raise exception 'O mesmo kit não pode aparecer em mais de uma linha do orçamento.';
  end if;

  for v_linha in
    select distinct item.kit_id
    from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id and item.kit_id is not null
  loop
    v_disponibilidade := public.verificar_disponibilidade_kit(
      v_linha.kit_id,
      coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
      coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
      null
    );

    if not coalesce((v_disponibilidade->>'disponivel')::boolean, false) then
      raise exception '%', coalesce(
        v_disponibilidade->>'motivo',
        'Um dos kits não está disponível no período informado.'
      );
    end if;
  end loop;

  select item.kit_id into v_kit_id
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id and item.kit_id is not null
  order by item.created_at
  limit 1;

  select string_agg(
    trim(to_char(item.quantidade, 'FM999999990D00')) || 'x ' ||
    item.descricao || ' — R$ ' ||
    trim(to_char(item.subtotal, 'FM999999990D00')),
    E'\n' order by item.created_at
  ) into v_itens
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id;

  insert into public.reservas (
    cliente_id, kit_id, data_evento, horario_evento, endereco_evento,
    valor_total, valor_sinal, status, observacoes, data_retirada,
    data_devolucao, status_comercial, status_operacional,
    status_pagamento, orcamento_id
  ) values (
    v_cliente_id,
    v_kit_id,
    v_orcamento.data_evento,
    v_orcamento.horario_evento,
    v_orcamento.endereco_evento,
    v_orcamento.total,
    0,
    'Confirmada',
    concat_ws(
      E'\n\n',
      'Reserva gerada automaticamente pelo ORC-' || lpad(v_orcamento.numero::text, 4, '0') || '.',
      nullif(v_orcamento.observacoes, ''),
      'Itens do orçamento:' || E'\n' || coalesce(v_itens, '-')
    ),
    coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
    coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
    'Confirmada',
    'Aguardando operação',
    'Pendente',
    p_orcamento_id
  ) returning id into v_reserva_id;

  for v_linha in
    select * from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id
    order by item.created_at
  loop
    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, kit_id, descricao, quantidade, valor_unitario, ordem
    ) values (
      v_reserva_id,
      v_linha.kit_id,
      v_linha.descricao,
      case when v_linha.kit_id is not null then 1 else v_linha.quantidade end,
      case when v_linha.kit_id is not null then v_linha.subtotal else v_linha.valor_unitario end,
      v_ordem
    );
  end loop;

  if coalesce(v_orcamento.desconto, 0) > 0 then
    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, descricao, quantidade, valor_unitario, ordem
    ) values (v_reserva_id, 'Desconto comercial', 1, -v_orcamento.desconto, v_ordem);
  end if;

  if coalesce(v_orcamento.acrescimos, 0) > 0 then
    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, descricao, quantidade, valor_unitario, ordem
    ) values (v_reserva_id, 'Acréscimos', 1, v_orcamento.acrescimos, v_ordem);
  end if;

  if coalesce(v_orcamento.frete, 0) > 0 then
    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, descricao, quantidade, valor_unitario, ordem
    ) values (v_reserva_id, 'Frete', 1, v_orcamento.frete, v_ordem);
  end if;

  update public.orcamentos
  set status = 'Aprovado', reserva_id = v_reserva_id
  where id = p_orcamento_id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set etapa = 'Fechado'
    where id = v_orcamento.oportunidade_id and etapa <> 'Perdido';
  end if;

  return jsonb_build_object(
    'reserva_id', v_reserva_id,
    'criada', true,
    'mensagem', 'Orçamento aprovado e reserva com todos os itens criada com sucesso.'
  );
end;
$$;

revoke all on function public.aprovar_orcamento_e_criar_reserva(uuid) from public;
grant execute on function public.aprovar_orcamento_e_criar_reserva(uuid) to authenticated;

create or replace function public.salvar_reserva_com_itens(
  p_reserva_id uuid,
  p_cliente_id uuid,
  p_data_evento date,
  p_horario_evento text,
  p_endereco_evento text,
  p_valor_sinal numeric,
  p_status text,
  p_observacoes text,
  p_itens jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva_id uuid := p_reserva_id;
  v_kit_id uuid;
  v_item record;
  v_ordem integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente no ERP.';
  end if;

  if p_cliente_id is null then raise exception 'Selecione um cliente.'; end if;
  if p_data_evento is null then raise exception 'Informe a data do evento.'; end if;

  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) = 0 then
    raise exception 'Adicione pelo menos um kit ou item à reserva.';
  end if;

  select x.kit_id into v_kit_id
  from jsonb_to_recordset(p_itens) as x(
    kit_id uuid, descricao text, quantidade numeric, valor_unitario numeric
  )
  where x.kit_id is not null
  limit 1;

  if v_kit_id is null then
    raise exception 'Adicione pelo menos um kit à reserva.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens) as x(
      kit_id uuid, descricao text, quantidade numeric, valor_unitario numeric
    )
    where x.kit_id is not null
    group by x.kit_id
    having count(*) > 1
  ) then
    raise exception 'O mesmo kit não pode aparecer mais de uma vez na reserva.';
  end if;

  if v_reserva_id is null then
    insert into public.reservas (
      cliente_id, kit_id, data_evento, horario_evento, endereco_evento,
      valor_total, valor_sinal, status, observacoes
    ) values (
      p_cliente_id,
      v_kit_id,
      p_data_evento,
      nullif(trim(coalesce(p_horario_evento, '')), ''),
      nullif(trim(coalesce(p_endereco_evento, '')), ''),
      0,
      greatest(coalesce(p_valor_sinal, 0), 0),
      coalesce(nullif(trim(p_status), ''), 'Pendente'),
      nullif(trim(coalesce(p_observacoes, '')), '')
    ) returning id into v_reserva_id;
  else
    update public.reservas
    set cliente_id = p_cliente_id,
        kit_id = v_kit_id,
        data_evento = p_data_evento,
        horario_evento = nullif(trim(coalesce(p_horario_evento, '')), ''),
        endereco_evento = nullif(trim(coalesce(p_endereco_evento, '')), ''),
        valor_sinal = greatest(coalesce(p_valor_sinal, 0), 0),
        status = coalesce(nullif(trim(p_status), ''), 'Pendente'),
        observacoes = nullif(trim(coalesce(p_observacoes, '')), '')
    where id = v_reserva_id;

    if not found then raise exception 'Reserva não encontrada.'; end if;
    delete from public.reserva_itens where reserva_id = v_reserva_id;
  end if;

  for v_item in
    select * from jsonb_to_recordset(p_itens) as x(
      kit_id uuid, descricao text, quantidade numeric, valor_unitario numeric
    )
  loop
    if length(trim(coalesce(v_item.descricao, ''))) < 2 then
      raise exception 'Todos os itens precisam de descrição.';
    end if;
    if coalesce(v_item.quantidade, 0) <= 0 then
      raise exception 'A quantidade dos itens deve ser maior que zero.';
    end if;
    if v_item.kit_id is not null and v_item.quantidade <> 1 then
      raise exception 'Cada kit deve ser incluído em uma linha individual.';
    end if;

    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, kit_id, descricao, quantidade, valor_unitario, ordem
    ) values (
      v_reserva_id,
      v_item.kit_id,
      left(trim(v_item.descricao), 300),
      v_item.quantidade,
      coalesce(v_item.valor_unitario, 0),
      v_ordem
    );
  end loop;

  return v_reserva_id;
end;
$$;

revoke all on function public.salvar_reserva_com_itens(uuid, uuid, date, text, text, numeric, text, text, jsonb) from public;
grant execute on function public.salvar_reserva_com_itens(uuid, uuid, date, text, text, numeric, text, text, jsonb) to authenticated;

-- Consolida a composição física de todos os kits da reserva para a conferência.
create or replace function public.composicao_reserva(p_reserva_id uuid)
returns table (item_id uuid, quantidade integer)
language sql
stable
security definer
set search_path = public
as $$
  with kits_reserva as (
    select item.kit_id
    from public.reserva_itens item
    where item.reserva_id = p_reserva_id
      and item.kit_id is not null
    union
    select reserva.kit_id
    from public.reservas reserva
    where reserva.id = p_reserva_id
      and reserva.kit_id is not null
      and not exists (
        select 1
        from public.reserva_itens item
        where item.reserva_id = reserva.id
          and item.kit_id is not null
      )
  )
  select composicao.item_id, sum(composicao.quantidade)::integer
  from kits_reserva kit
  join public.kit_composicao composicao on composicao.kit_id = kit.kit_id
  group by composicao.item_id;
$$;

revoke all on function public.composicao_reserva(uuid) from public;

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

  select status into v_status_reserva
  from public.reservas
  where id = p_reserva_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  select id into v_conferencia_id
  from public.conferencias
  where reserva_id = p_reserva_id and tipo = p_tipo;

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

  select count(*) into v_total_composicao
  from public.composicao_reserva(p_reserva_id);

  if v_total_composicao = 0 then
    raise exception 'Os kits da reserva ainda não possuem composição cadastrada.';
  end if;

  select count(*) into v_total_informado
  from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
    item_id uuid,
    quantidade_conferida integer,
    quantidade_danificada integer,
    observacoes text
  );

  if v_total_informado <> v_total_composicao then
    raise exception 'O checklist deve conter todos os itens da composição dos kits.';
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
    left join public.composicao_reserva(p_reserva_id) composicao
      on composicao.item_id = x.item_id
    where composicao.item_id is null
       or coalesce(x.quantidade_conferida, 0) < 0
       or coalesce(x.quantidade_conferida, 0) > composicao.quantidade
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
    join public.composicao_reserva(p_reserva_id) composicao
      on composicao.item_id = x.item_id
    where coalesce(x.quantidade_danificada, 0) > 0
       or coalesce(x.quantidade_conferida, 0) < composicao.quantidade
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
          composicao.item_id,
          greatest(coalesce(x.quantidade_danificada, 0), 0) as danificado,
          greatest(composicao.quantidade - coalesce(x.quantidade_conferida, 0), 0) as faltante,
          nullif(trim(coalesce(x.observacoes, '')), '') as observacoes
        from public.composicao_reserva(p_reserva_id) composicao
        join jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
          item_id uuid,
          quantidade_conferida integer,
          quantidade_danificada integer,
          observacoes text
        ) on x.item_id = composicao.item_id
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
    composicao.item_id,
    composicao.quantidade,
    greatest(coalesce(x.quantidade_conferida, 0), 0),
    greatest(coalesce(x.quantidade_danificada, 0), 0),
    greatest(composicao.quantidade - coalesce(x.quantidade_conferida, 0), 0),
    nullif(trim(coalesce(x.observacoes, '')), '')
  from public.composicao_reserva(p_reserva_id) composicao
  join jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(
    item_id uuid,
    quantidade_conferida integer,
    quantidade_danificada integer,
    observacoes text
  ) on x.item_id = composicao.item_id;

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
