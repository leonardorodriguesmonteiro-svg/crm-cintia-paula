-- Terceira entrega comercial: aprovação transacional do orçamento e geração da reserva.

alter table public.orcamentos
add column if not exists reserva_id uuid references public.reservas(id) on delete set null;

alter table public.reservas
add column if not exists orcamento_id uuid references public.orcamentos(id) on delete set null;

create unique index if not exists orcamentos_reserva_unique
on public.orcamentos(reserva_id)
where reserva_id is not null;

create unique index if not exists reservas_orcamento_unique
on public.reservas(orcamento_id)
where orcamento_id is not null;

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
  v_quantidade_kit numeric(10, 2);
  v_total_kits integer;
  v_disponibilidade jsonb;
  v_reserva_id uuid;
  v_itens text;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente no ERP.';
  end if;

  select *
  into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;

  if v_orcamento.reserva_id is not null then
    return jsonb_build_object(
      'reserva_id', v_orcamento.reserva_id,
      'criada', false,
      'mensagem', 'Este orçamento já possui uma reserva.'
    );
  end if;

  select r.id
  into v_reserva_id
  from public.reservas r
  where r.orcamento_id = p_orcamento_id
  limit 1;

  if v_reserva_id is not null then
    update public.orcamentos
    set reserva_id = v_reserva_id,
        status = 'Aprovado'
    where id = p_orcamento_id;

    return jsonb_build_object(
      'reserva_id', v_reserva_id,
      'criada', false,
      'mensagem', 'A reserva existente foi vinculada ao orçamento.'
    );
  end if;

  v_cliente_id := v_orcamento.cliente_id;

  if v_cliente_id is null and v_orcamento.oportunidade_id is not null then
    select *
    into v_oportunidade
    from public.oportunidades
    where id = v_orcamento.oportunidade_id;

    if found then
      select cliente.id
      into v_cliente_id
      from public.clientes cliente
      where cliente.whatsapp = v_oportunidade.celular
      limit 1;

      if v_cliente_id is null then
        insert into public.clientes (
          nome,
          whatsapp,
          email,
          origem,
          status,
          observacoes
        ) values (
          v_oportunidade.nome_contato,
          v_oportunidade.celular,
          v_oportunidade.email,
          v_oportunidade.origem,
          'Cliente',
          'Cliente criado automaticamente na aprovação do orçamento.'
        )
        returning id into v_cliente_id;
      end if;

      update public.oportunidades
      set cliente_id = v_cliente_id
      where id = v_oportunidade.id;

      update public.orcamentos
      set cliente_id = v_cliente_id
      where id = p_orcamento_id;
    end if;
  end if;

  if v_cliente_id is null then
    raise exception 'Não foi possível identificar o cliente deste orçamento.';
  end if;

  if v_orcamento.data_evento is null then
    raise exception 'Informe a data do evento antes de aprovar o orçamento.';
  end if;

  select count(*)::integer
  into v_total_kits
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id
    and item.kit_id is not null;

  if v_total_kits = 0 then
    raise exception 'Adicione um kit ao orçamento antes de gerar a reserva.';
  end if;

  if v_total_kits > 1 then
    raise exception 'A conversão automática aceita um kit por reserva. Mantenha um kit e registre os demais componentes como adicionais.';
  end if;

  select item.kit_id, item.quantidade
  into v_kit_id, v_quantidade_kit
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id
    and item.kit_id is not null
  limit 1;

  if v_quantidade_kit <> 1 then
    raise exception 'A conversão automática aceita uma unidade do kit por reserva.';
  end if;

  v_disponibilidade := public.verificar_disponibilidade_kit(
    v_kit_id,
    coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
    coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
    null
  );

  if not coalesce((v_disponibilidade->>'disponivel')::boolean, false) then
    raise exception '%', coalesce(
      v_disponibilidade->>'motivo',
      'O kit não está disponível no período informado.'
    );
  end if;

  select string_agg(
    trim(to_char(item.quantidade, 'FM999999990D00')) || 'x ' ||
    item.descricao || ' — R$ ' ||
    trim(to_char(item.subtotal, 'FM999999990D00')),
    E'\n' order by item.created_at
  )
  into v_itens
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id;

  insert into public.reservas (
    cliente_id,
    kit_id,
    data_evento,
    horario_evento,
    endereco_evento,
    valor_total,
    valor_sinal,
    status,
    observacoes,
    data_retirada,
    data_devolucao,
    status_comercial,
    status_operacional,
    status_pagamento,
    orcamento_id
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
  )
  returning id into v_reserva_id;

  update public.orcamentos
  set status = 'Aprovado',
      reserva_id = v_reserva_id
  where id = p_orcamento_id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set etapa = 'Fechado'
    where id = v_orcamento.oportunidade_id
      and etapa <> 'Perdido';
  end if;

  return jsonb_build_object(
    'reserva_id', v_reserva_id,
    'criada', true,
    'mensagem', 'Orçamento aprovado e reserva criada com sucesso.'
  );
end;
$$;

revoke all on function public.aprovar_orcamento_e_criar_reserva(uuid) from public;
grant execute on function public.aprovar_orcamento_e_criar_reserva(uuid) to authenticated;
