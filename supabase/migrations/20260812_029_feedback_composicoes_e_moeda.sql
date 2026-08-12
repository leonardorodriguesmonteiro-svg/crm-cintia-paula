-- Nona entrega: rastreio das composições cobradas em cada reserva.

alter table public.reserva_itens
add column if not exists kit_composicao_id uuid
references public.kit_composicao(id) on delete set null;

create unique index if not exists reserva_itens_reserva_composicao_unique
on public.reserva_itens(reserva_id, kit_composicao_id)
where kit_composicao_id is not null;

create index if not exists reserva_itens_composicao_idx
on public.reserva_itens(kit_composicao_id)
where kit_composicao_id is not null;

-- Salva a reserva e preserva a origem de cada ajuste de composição.
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
    kit_id uuid,
    kit_composicao_id uuid,
    descricao text,
    quantidade numeric,
    valor_unitario numeric
  )
  where x.kit_id is not null
  limit 1;

  if v_kit_id is null then
    raise exception 'Adicione pelo menos um kit à reserva.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens) as x(
      kit_id uuid,
      kit_composicao_id uuid,
      descricao text,
      quantidade numeric,
      valor_unitario numeric
    )
    where x.kit_id is not null
    group by x.kit_id
    having count(*) > 1
  ) then
    raise exception 'O mesmo kit não pode aparecer mais de uma vez na reserva.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens) as x(
      kit_id uuid,
      kit_composicao_id uuid,
      descricao text,
      quantidade numeric,
      valor_unitario numeric
    )
    where x.kit_composicao_id is not null
    group by x.kit_composicao_id
    having count(*) > 1
  ) then
    raise exception 'A mesma composição não pode aparecer mais de uma vez na reserva.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_itens) as x(
      kit_id uuid,
      kit_composicao_id uuid,
      descricao text,
      quantidade numeric,
      valor_unitario numeric
    )
    join public.kit_composicao composicao
      on composicao.id = x.kit_composicao_id
    where x.kit_composicao_id is not null
      and not exists (
        select 1
        from jsonb_to_recordset(p_itens) as kit(
          kit_id uuid,
          kit_composicao_id uuid,
          descricao text,
          quantidade numeric,
          valor_unitario numeric
        )
        where kit.kit_id = composicao.kit_id
      )
  ) then
    raise exception 'Uma composição informada não pertence aos kits da reserva.';
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
      kit_id uuid,
      kit_composicao_id uuid,
      descricao text,
      quantidade numeric,
      valor_unitario numeric
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
      reserva_id, kit_id, kit_composicao_id, descricao,
      quantidade, valor_unitario, ordem
    ) values (
      v_reserva_id,
      v_item.kit_id,
      v_item.kit_composicao_id,
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
