-- Sétima entrega comercial: Checkout Pro e conciliação automática do sinal.

alter table public.lancamentos_financeiros
add column if not exists provedor_pagamento text;

alter table public.lancamentos_financeiros
add column if not exists provedor_preferencia_id text;

alter table public.lancamentos_financeiros
add column if not exists provedor_pagamento_id text;

alter table public.lancamentos_financeiros
add column if not exists link_pagamento text;

alter table public.lancamentos_financeiros
add column if not exists status_provedor text;

alter table public.lancamentos_financeiros
add column if not exists status_detalhe_provedor text;

alter table public.lancamentos_financeiros
add column if not exists provedor_atualizado_em timestamptz;

create unique index if not exists lancamentos_provedor_preferencia_unique
on public.lancamentos_financeiros(provedor_pagamento, provedor_preferencia_id)
where provedor_pagamento is not null and provedor_preferencia_id is not null;

create unique index if not exists lancamentos_provedor_pagamento_unique
on public.lancamentos_financeiros(provedor_pagamento, provedor_pagamento_id)
where provedor_pagamento is not null and provedor_pagamento_id is not null;

create table if not exists public.pagamento_webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  provedor text not null,
  pagamento_id text not null,
  acao text not null,
  status text,
  request_id text,
  external_reference text,
  erro text,
  processado_em timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists pagamento_webhook_eventos_idempotencia_unique
on public.pagamento_webhook_eventos(provedor, pagamento_id, acao, coalesce(status, ''));

alter table public.pagamento_webhook_eventos enable row level security;

drop policy if exists "auth leitura pagamento_webhook_eventos"
on public.pagamento_webhook_eventos;

create policy "auth leitura pagamento_webhook_eventos"
on public.pagamento_webhook_eventos
for select to authenticated
using (true);

create or replace function public.registrar_preferencia_mercado_pago(
  p_lancamento_id uuid,
  p_preferencia_id text,
  p_link_pagamento text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lancamento public.lancamentos_financeiros%rowtype;
begin
  if length(trim(coalesce(p_preferencia_id, ''))) < 3 then
    raise exception 'Preferência do Mercado Pago inválida.';
  end if;

  if left(lower(trim(coalesce(p_link_pagamento, ''))), 8) <> 'https://' then
    raise exception 'Link de pagamento inválido.';
  end if;

  select * into v_lancamento
  from public.lancamentos_financeiros
  where id = p_lancamento_id
  for update;

  if not found or v_lancamento.categoria <> 'Sinal' then
    raise exception 'Cobrança do sinal não encontrada.';
  end if;

  if v_lancamento.status = 'Pago' then
    return jsonb_build_object(
      'lancamento_id', v_lancamento.id,
      'status', 'Pago',
      'link_pagamento', v_lancamento.link_pagamento,
      'ja_pago', true
    );
  end if;

  update public.lancamentos_financeiros
  set provedor_pagamento = 'Mercado Pago',
      provedor_preferencia_id = left(trim(p_preferencia_id), 180),
      link_pagamento = left(trim(p_link_pagamento), 1000),
      status_provedor = 'preference_created',
      status_detalhe_provedor = null,
      provedor_atualizado_em = now()
  where id = p_lancamento_id;

  return jsonb_build_object(
    'lancamento_id', p_lancamento_id,
    'status', 'Pendente',
    'link_pagamento', left(trim(p_link_pagamento), 1000),
    'ja_pago', false
  );
end;
$$;

create or replace function public.conciliar_pagamento_mercado_pago(
  p_lancamento_id uuid,
  p_pagamento_id text,
  p_status text,
  p_status_detalhe text,
  p_forma_pagamento text,
  p_valor numeric,
  p_pago_em timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lancamento public.lancamentos_financeiros%rowtype;
  v_orcamento public.orcamentos%rowtype;
  v_contrato_assinado boolean := false;
  v_formalizacao_status text;
  v_data_pagamento date;
  v_status_normalizado text := lower(trim(coalesce(p_status, '')));
  v_forma text := coalesce(nullif(trim(p_forma_pagamento), ''), 'Mercado Pago');
begin
  select * into v_lancamento
  from public.lancamentos_financeiros
  where id = p_lancamento_id
  for update;

  if not found or v_lancamento.categoria <> 'Sinal' then
    raise exception 'Cobrança do sinal não encontrada.';
  end if;

  if length(trim(coalesce(p_pagamento_id, ''))) < 1 then
    raise exception 'Pagamento do Mercado Pago inválido.';
  end if;

  if v_status_normalizado = 'approved'
    and abs(coalesce(p_valor, 0) - coalesce(v_lancamento.valor, 0)) > 0.01 then
    raise exception 'O valor aprovado no Mercado Pago não corresponde ao sinal.';
  end if;

  update public.lancamentos_financeiros
  set provedor_pagamento = 'Mercado Pago',
      provedor_pagamento_id = left(trim(p_pagamento_id), 180),
      status_provedor = left(v_status_normalizado, 80),
      status_detalhe_provedor = nullif(left(trim(coalesce(p_status_detalhe, '')), 180), ''),
      provedor_atualizado_em = now()
  where id = v_lancamento.id;

  select * into v_orcamento
  from public.orcamentos
  where lancamento_sinal_id = v_lancamento.id
  for update;

  if v_status_normalizado = 'approved' then
    v_data_pagamento := (coalesce(p_pago_em, now()) at time zone 'America/Sao_Paulo')::date;

    update public.lancamentos_financeiros
    set status = 'Pago',
        data_pagamento = v_data_pagamento,
        forma_pagamento = v_forma
    where id = v_lancamento.id;

    insert into public.recebimentos (
      reserva_id,
      lancamento_id,
      valor,
      data_recebimento,
      forma_pagamento,
      status,
      observacoes
    ) values (
      v_lancamento.reserva_id,
      v_lancamento.id,
      v_lancamento.valor,
      v_data_pagamento,
      v_forma,
      'Pago',
      'Sinal conciliado automaticamente pelo Mercado Pago. Pagamento ' || trim(p_pagamento_id) || '.'
    )
    on conflict (lancamento_id) where lancamento_id is not null
    do update set
      valor = excluded.valor,
      data_recebimento = excluded.data_recebimento,
      forma_pagamento = excluded.forma_pagamento,
      status = 'Pago',
      observacoes = excluded.observacoes;

    update public.reservas
    set valor_sinal = v_lancamento.valor,
        status_pagamento = 'Sinal pago',
        data_pagamento_sinal = v_data_pagamento,
        forma_pagamento_sinal = v_forma,
        status_comercial = 'Confirmada'
    where id = v_lancamento.reserva_id;

    if v_orcamento.id is not null then
      select contrato.status = 'Assinado'
      into v_contrato_assinado
      from public.contratos contrato
      where contrato.id = v_orcamento.contrato_id;

      v_formalizacao_status := case when coalesce(v_contrato_assinado, false)
        then 'Venda confirmada'
        else 'Aguardando contrato'
      end;

      update public.orcamentos
      set formalizacao_status = v_formalizacao_status,
          sinal_pago_em = coalesce(sinal_pago_em, coalesce(p_pago_em, now())),
          formalizado_em = case when v_formalizacao_status = 'Venda confirmada'
            then coalesce(formalizado_em, coalesce(p_pago_em, now()))
            else formalizado_em
          end
      where id = v_orcamento.id;

      if v_formalizacao_status = 'Venda confirmada' and v_orcamento.oportunidade_id is not null then
        update public.oportunidades
        set etapa = 'Fechado'
        where id = v_orcamento.oportunidade_id
          and etapa <> 'Perdido';
      end if;
    end if;
  elsif v_status_normalizado in ('refunded', 'charged_back') then
    update public.recebimentos
    set status = 'Cancelado',
        observacoes = concat_ws(
          E'\n',
          observacoes,
          'Pagamento estornado pelo Mercado Pago em ' ||
            to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.'
        )
    where lancamento_id = v_lancamento.id;

    update public.lancamentos_financeiros
    set status = 'Pendente',
        data_pagamento = null,
        forma_pagamento = null
    where id = v_lancamento.id;

    update public.reservas
    set status_pagamento = 'Pendente',
        data_pagamento_sinal = null,
        forma_pagamento_sinal = null
    where id = v_lancamento.reserva_id;

    if v_orcamento.id is not null then
      update public.orcamentos
      set formalizacao_status = case when contrato_assinado_em is not null
            then 'Aguardando sinal'
            else 'Aguardando contrato'
          end,
          sinal_pago_em = null,
          formalizado_em = null
      where id = v_orcamento.id;

      if v_orcamento.oportunidade_id is not null then
        update public.oportunidades
        set etapa = 'Negociação'
        where id = v_orcamento.oportunidade_id
          and etapa = 'Fechado';
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'lancamento_id', v_lancamento.id,
    'pagamento_id', trim(p_pagamento_id),
    'status_provedor', v_status_normalizado,
    'conciliado', v_status_normalizado = 'approved'
  );
end;
$$;

revoke all on function public.registrar_preferencia_mercado_pago(uuid, text, text)
from public;

revoke all on function public.conciliar_pagamento_mercado_pago(uuid, text, text, text, text, numeric, timestamptz)
from public;

grant execute on function public.registrar_preferencia_mercado_pago(uuid, text, text)
to service_role;

grant execute on function public.conciliar_pagamento_mercado_pago(uuid, text, text, text, text, numeric, timestamptz)
to service_role;
