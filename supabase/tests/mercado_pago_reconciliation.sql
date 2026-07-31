-- Teste transacional da conciliação do Mercado Pago.
-- Nenhum dado permanece no banco: toda a execução termina com rollback.

begin;

do $$
declare
  v_reserva_id uuid;
  v_lancamento_id uuid;
  v_status text;
  v_status_provedor text;
  v_link text;
  v_status_recebimento text;
  v_status_pagamento_reserva text;
begin
  insert into public.reservas (
    data_evento,
    valor_total,
    valor_sinal,
    status,
    observacoes
  ) values (
    current_date + 30,
    1000,
    0,
    'Pendente',
    'TESTE TRANSACIONAL MERCADO PAGO'
  )
  returning id into v_reserva_id;

  insert into public.lancamentos_financeiros (
    reserva_id,
    tipo,
    descricao,
    categoria,
    valor,
    data_vencimento,
    status,
    observacoes
  ) values (
    v_reserva_id,
    'Receita',
    'TESTE SINAL MERCADO PAGO',
    'Sinal',
    250,
    current_date + 5,
    'Pendente',
    'TESTE TRANSACIONAL MERCADO PAGO'
  )
  returning id into v_lancamento_id;

  perform public.registrar_preferencia_mercado_pago(
    v_lancamento_id,
    'teste-preferencia-mercado-pago',
    'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=teste'
  );

  select status_provedor, link_pagamento
  into v_status_provedor, v_link
  from public.lancamentos_financeiros
  where id = v_lancamento_id;

  if v_status_provedor <> 'preference_created' or v_link is null then
    raise exception 'A preferência de teste não foi registrada corretamente.';
  end if;

  perform public.conciliar_pagamento_mercado_pago(
    v_lancamento_id,
    'teste-pagamento-mercado-pago',
    'approved',
    'accredited',
    'Mercado Pago · pix',
    250,
    now()
  );

  select status, status_provedor
  into v_status, v_status_provedor
  from public.lancamentos_financeiros
  where id = v_lancamento_id;

  select status
  into v_status_recebimento
  from public.recebimentos
  where lancamento_id = v_lancamento_id;

  select status_pagamento
  into v_status_pagamento_reserva
  from public.reservas
  where id = v_reserva_id;

  if v_status <> 'Pago'
    or v_status_provedor <> 'approved'
    or v_status_recebimento <> 'Pago'
    or v_status_pagamento_reserva <> 'Sinal pago' then
    raise exception 'A aprovação de teste não foi conciliada corretamente.';
  end if;

  perform public.conciliar_pagamento_mercado_pago(
    v_lancamento_id,
    'teste-pagamento-mercado-pago',
    'refunded',
    'refunded',
    'Mercado Pago · pix',
    250,
    now()
  );

  select status, status_provedor
  into v_status, v_status_provedor
  from public.lancamentos_financeiros
  where id = v_lancamento_id;

  select status
  into v_status_recebimento
  from public.recebimentos
  where lancamento_id = v_lancamento_id;

  select status_pagamento
  into v_status_pagamento_reserva
  from public.reservas
  where id = v_reserva_id;

  if v_status <> 'Pendente'
    or v_status_provedor <> 'refunded'
    or v_status_recebimento <> 'Cancelado'
    or v_status_pagamento_reserva <> 'Pendente' then
    raise exception 'O estorno de teste não foi conciliado corretamente.';
  end if;
end;
$$;

rollback;

select 'Conciliação Mercado Pago aprovada e revertida; dados temporários removidos.' as resultado;
