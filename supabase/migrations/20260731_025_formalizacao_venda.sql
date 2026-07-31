-- Quinta entrega comercial: formalização transacional da venda aprovada.

alter table public.orcamentos
add column if not exists formalizacao_status text;

alter table public.orcamentos
add column if not exists contrato_id uuid references public.contratos(id) on delete set null;

alter table public.orcamentos
add column if not exists lancamento_sinal_id uuid references public.lancamentos_financeiros(id) on delete set null;

alter table public.orcamentos
add column if not exists valor_sinal_formalizacao numeric(12, 2);

alter table public.orcamentos
add column if not exists vencimento_sinal date;

alter table public.orcamentos
add column if not exists formalizado_em timestamptz;

alter table public.orcamentos
add column if not exists contrato_assinado_em timestamptz;

alter table public.orcamentos
add column if not exists sinal_pago_em timestamptz;

alter table public.recebimentos
add column if not exists lancamento_id uuid references public.lancamentos_financeiros(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orcamentos_formalizacao_status_check'
  ) then
    alter table public.orcamentos
    add constraint orcamentos_formalizacao_status_check
    check (
      formalizacao_status is null
      or formalizacao_status in (
        'Aguardando formalização',
        'Aguardando contrato',
        'Aguardando sinal',
        'Venda confirmada',
        'Cancelada'
      )
    );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orcamentos_valor_sinal_formalizacao_check'
  ) then
    alter table public.orcamentos
    add constraint orcamentos_valor_sinal_formalizacao_check
    check (valor_sinal_formalizacao is null or valor_sinal_formalizacao > 0);
  end if;
end;
$$;

create unique index if not exists contratos_reserva_unique
on public.contratos(reserva_id)
where reserva_id is not null;

create unique index if not exists contratos_numero_unique
on public.contratos(numero_contrato);

create unique index if not exists orcamentos_contrato_unique
on public.orcamentos(contrato_id)
where contrato_id is not null;

create unique index if not exists orcamentos_lancamento_sinal_unique
on public.orcamentos(lancamento_sinal_id)
where lancamento_sinal_id is not null;

create unique index if not exists recebimentos_lancamento_unique
on public.recebimentos(lancamento_id)
where lancamento_id is not null;

create or replace function public.sincronizar_status_formalizacao_orcamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Aprovado' and new.formalizacao_status is null then
    new.formalizacao_status := 'Aguardando formalização';
  elsif new.status in ('Recusado', 'Expirado')
    and new.formalizacao_status is not null
    and new.formalizacao_status <> 'Venda confirmada' then
    new.formalizacao_status := 'Cancelada';
  end if;

  return new;
end;
$$;

drop trigger if exists sincronizar_status_formalizacao_orcamento
on public.orcamentos;

create trigger sincronizar_status_formalizacao_orcamento
before insert or update of status, formalizacao_status
on public.orcamentos
for each row execute function public.sincronizar_status_formalizacao_orcamento();

update public.orcamentos
set formalizacao_status = case
  when status = 'Aprovado' and reserva_id is null then 'Aguardando formalização'
  when status = 'Aprovado' and reserva_id is not null then 'Aguardando contrato'
  when status in ('Recusado', 'Expirado') then 'Cancelada'
  else formalizacao_status
end
where formalizacao_status is null
  and status in ('Aprovado', 'Recusado', 'Expirado');

create or replace function public.formalizar_orcamento_aprovado(
  p_orcamento_id uuid,
  p_valor_sinal numeric,
  p_vencimento date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_conversao jsonb;
  v_reserva_id uuid;
  v_contrato_id uuid;
  v_lancamento_id uuid;
  v_numero_contrato text;
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

  if v_orcamento.status <> 'Aprovado' then
    raise exception 'O cliente precisa aprovar o orçamento antes da formalização.';
  end if;

  if coalesce(p_valor_sinal, 0) <= 0 then
    raise exception 'Informe um valor de sinal maior que zero.';
  end if;

  if p_valor_sinal > v_orcamento.total then
    raise exception 'O sinal não pode ser maior que o total do orçamento.';
  end if;

  if p_vencimento is null then
    raise exception 'Informe a data de vencimento do sinal.';
  end if;

  v_conversao := public.aprovar_orcamento_e_criar_reserva(p_orcamento_id);
  v_reserva_id := (v_conversao->>'reserva_id')::uuid;

  if v_reserva_id is null then
    raise exception 'Não foi possível criar ou localizar a reserva.';
  end if;

  v_contrato_id := v_orcamento.contrato_id;

  if v_contrato_id is null then
    select contrato.id
    into v_contrato_id
    from public.contratos contrato
    where contrato.reserva_id = v_reserva_id
    limit 1;
  end if;

  if v_contrato_id is null then
    v_numero_contrato := 'CTR-' ||
      extract(year from (now() at time zone 'America/Sao_Paulo'))::integer::text || '-' ||
      lpad(v_orcamento.numero::text, 4, '0');

    insert into public.contratos (
      reserva_id,
      numero_contrato,
      status,
      observacoes
    ) values (
      v_reserva_id,
      v_numero_contrato,
      'Gerado',
      'Contrato gerado automaticamente na formalização do ORC-' ||
        lpad(v_orcamento.numero::text, 4, '0') || '.'
    )
    returning id into v_contrato_id;

    insert into public.contrato_versoes (
      contrato_id,
      versao,
      conteudo,
      status
    ) values (
      v_contrato_id,
      1,
      'Contrato gerado automaticamente a partir do orçamento ORC-' ||
        lpad(v_orcamento.numero::text, 4, '0') || '.',
      'Rascunho'
    );
  end if;

  v_lancamento_id := v_orcamento.lancamento_sinal_id;

  if v_lancamento_id is null then
    select lancamento.id
    into v_lancamento_id
    from public.lancamentos_financeiros lancamento
    where lancamento.reserva_id = v_reserva_id
      and lancamento.categoria = 'Sinal'
      and lancamento.status <> 'Cancelado'
    order by lancamento.created_at
    limit 1;
  end if;

  if v_lancamento_id is null then
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
      'Sinal do ORC-' || lpad(v_orcamento.numero::text, 4, '0'),
      'Sinal',
      p_valor_sinal,
      p_vencimento,
      'Pendente',
      'Cobrança criada automaticamente na formalização da venda.'
    )
    returning id into v_lancamento_id;
  else
    update public.lancamentos_financeiros
    set valor = p_valor_sinal,
        data_vencimento = p_vencimento
    where id = v_lancamento_id
      and status = 'Pendente';
  end if;

  update public.reservas
  set valor_sinal = p_valor_sinal,
      status_pagamento = case
        when status_pagamento in ('Pago', 'Quitado', 'Sinal pago') then status_pagamento
        else 'Pendente'
      end
  where id = v_reserva_id;

  update public.orcamentos
  set reserva_id = v_reserva_id,
      contrato_id = v_contrato_id,
      lancamento_sinal_id = v_lancamento_id,
      valor_sinal_formalizacao = p_valor_sinal,
      vencimento_sinal = p_vencimento,
      formalizacao_status = 'Aguardando contrato'
  where id = p_orcamento_id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set etapa = 'Negociação',
        motivo_perda = null
    where id = v_orcamento.oportunidade_id
      and etapa <> 'Perdido';
  end if;

  return jsonb_build_object(
    'reserva_id', v_reserva_id,
    'contrato_id', v_contrato_id,
    'lancamento_sinal_id', v_lancamento_id,
    'status', 'Aguardando contrato',
    'mensagem', 'Reserva, contrato e cobrança do sinal criados com sucesso.'
  );
end;
$$;

create or replace function public.confirmar_assinatura_formalizacao(
  p_orcamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_sinal_pago boolean;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente no ERP.';
  end if;

  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found or v_orcamento.contrato_id is null then
    raise exception 'Formalize o orçamento antes de confirmar a assinatura.';
  end if;

  update public.contratos
  set status = 'Assinado',
      observacoes = concat_ws(
        E'\n',
        observacoes,
        'Assinatura confirmada pelo ERP em ' ||
          to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || '.'
      )
  where id = v_orcamento.contrato_id;

  select lancamento.status = 'Pago'
  into v_sinal_pago
  from public.lancamentos_financeiros lancamento
  where lancamento.id = v_orcamento.lancamento_sinal_id;

  v_status := case when coalesce(v_sinal_pago, false)
    then 'Venda confirmada'
    else 'Aguardando sinal'
  end;

  update public.orcamentos
  set formalizacao_status = v_status,
      contrato_assinado_em = coalesce(contrato_assinado_em, now()),
      formalizado_em = case when v_status = 'Venda confirmada' then now() else formalizado_em end
  where id = p_orcamento_id;

  if v_status = 'Venda confirmada' and v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set etapa = 'Fechado'
    where id = v_orcamento.oportunidade_id
      and etapa <> 'Perdido';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'mensagem', case when v_status = 'Venda confirmada'
      then 'Contrato assinado e venda confirmada.'
      else 'Contrato assinado. Aguardando o pagamento do sinal.'
    end
  );
end;
$$;

create or replace function public.confirmar_pagamento_sinal_formalizacao(
  p_orcamento_id uuid,
  p_forma_pagamento text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_lancamento public.lancamentos_financeiros%rowtype;
  v_contrato_assinado boolean;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente no ERP.';
  end if;

  if length(trim(coalesce(p_forma_pagamento, ''))) < 2 then
    raise exception 'Informe a forma de pagamento do sinal.';
  end if;

  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found or v_orcamento.lancamento_sinal_id is null then
    raise exception 'Formalize o orçamento antes de confirmar o sinal.';
  end if;

  select * into v_lancamento
  from public.lancamentos_financeiros
  where id = v_orcamento.lancamento_sinal_id
  for update;

  if not found then
    raise exception 'Cobrança do sinal não encontrada.';
  end if;

  update public.lancamentos_financeiros
  set status = 'Pago',
      data_pagamento = (now() at time zone 'America/Sao_Paulo')::date,
      forma_pagamento = trim(p_forma_pagamento)
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
    v_orcamento.reserva_id,
    v_lancamento.id,
    v_lancamento.valor,
    (now() at time zone 'America/Sao_Paulo')::date,
    trim(p_forma_pagamento),
    'Pago',
    'Sinal registrado automaticamente pela formalização da venda.'
  )
  on conflict (lancamento_id) where lancamento_id is not null
  do update set
    valor = excluded.valor,
    data_recebimento = excluded.data_recebimento,
    forma_pagamento = excluded.forma_pagamento,
    status = 'Pago';

  update public.reservas
  set valor_sinal = v_lancamento.valor,
      status_pagamento = 'Sinal pago',
      data_pagamento_sinal = (now() at time zone 'America/Sao_Paulo')::date,
      forma_pagamento_sinal = trim(p_forma_pagamento),
      status_comercial = 'Confirmada'
  where id = v_orcamento.reserva_id;

  select contrato.status = 'Assinado'
  into v_contrato_assinado
  from public.contratos contrato
  where contrato.id = v_orcamento.contrato_id;

  v_status := case when coalesce(v_contrato_assinado, false)
    then 'Venda confirmada'
    else 'Aguardando contrato'
  end;

  update public.orcamentos
  set formalizacao_status = v_status,
      sinal_pago_em = coalesce(sinal_pago_em, now()),
      formalizado_em = case when v_status = 'Venda confirmada' then now() else formalizado_em end
  where id = p_orcamento_id;

  if v_status = 'Venda confirmada' and v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set etapa = 'Fechado'
    where id = v_orcamento.oportunidade_id
      and etapa <> 'Perdido';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'mensagem', case when v_status = 'Venda confirmada'
      then 'Sinal recebido e venda confirmada.'
      else 'Sinal recebido. Aguardando a assinatura do contrato.'
    end
  );
end;
$$;

revoke all on function public.sincronizar_status_formalizacao_orcamento() from public;
revoke all on function public.formalizar_orcamento_aprovado(uuid, numeric, date) from public;
revoke all on function public.confirmar_assinatura_formalizacao(uuid) from public;
revoke all on function public.confirmar_pagamento_sinal_formalizacao(uuid, text) from public;

grant execute on function public.formalizar_orcamento_aprovado(uuid, numeric, date) to authenticated;
grant execute on function public.confirmar_assinatura_formalizacao(uuid) to authenticated;
grant execute on function public.confirmar_pagamento_sinal_formalizacao(uuid, text) to authenticated;
