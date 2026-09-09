-- Sprint Comercial 1.1 - Guarda complementar da confirmação V2.
-- Protege também INSERTs diretos legados e torna a emissão do evento de
-- confirmação idempotente por meio de nova_confirmacao.

create or replace function public.validar_confirmacao_reserva_formalizada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_contrato_assinado boolean := false;
  v_sinal_pago boolean := false;
  v_eh_nova_jornada boolean := false;
begin
  if new.status <> 'Confirmada' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'Confirmada' then
    return new;
  end if;

  select * into v_orcamento
  from public.orcamentos
  where id = new.orcamento_id
     or reserva_id = new.id
  order by case when id = new.orcamento_id then 0 else 1 end
  limit 1;

  if not found then
    return new;
  end if;

  v_eh_nova_jornada :=
    v_orcamento.status in (
      'RASCUNHO', 'ENVIADA', 'ACEITA', 'RECUSADA', 'EXPIRADA', 'CANCELADA'
    )
    or v_orcamento.formalizacao_status in (
      'AGUARDANDO_DADOS',
      'DADOS_COMPLEOS',
      'CONTRATO_GERADO',
      'CONTRATO_ENVIADO',
      'AGUARDANDO_ASSINATURA',
      'AGUARDANDO_PAGAMENTO',
      'PRONTA_PARA_CONFIRMAR',
      'RESERVA_CONFIRMADA'
    );

  if not v_eh_nova_jornada then
    return new;
  end if;

  select coalesce(contrato.status = 'Assinado', false)
  into v_contrato_assinado
  from public.contratos contrato
  where contrato.id = v_orcamento.contrato_id;

  select coalesce(lancamento.status = 'Pago', false)
  into v_sinal_pago
  from public.lancamentos_financeiros lancamento
  where lancamento.id = v_orcamento.lancamento_sinal_id;

  if not coalesce(v_contrato_assinado, false)
    or not coalesce(v_sinal_pago, false)
  then
    raise exception using
      errcode = '23514',
      message = 'A reserva da Jornada Comercial V2 só pode ser confirmada após contrato assinado e sinal pago.';
  end if;

  return new;
end;
$$;

drop trigger if exists validar_confirmacao_reserva_formalizada on public.reservas;
create trigger validar_confirmacao_reserva_formalizada
before insert or update of status on public.reservas
for each row execute function public.validar_confirmacao_reserva_formalizada();

create or replace function public.tentar_confirmar_reserva_formalizada(
  p_orcamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_reserva public.reservas%rowtype;
  v_contrato_assinado boolean := false;
  v_sinal_pago boolean := false;
  v_item record;
  v_disponibilidade jsonb;
  v_motivo text;
  v_status text;
begin
  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Proposta não encontrada.';
  end if;

  if v_orcamento.reserva_id is null then
    return jsonb_build_object(
      'confirmada', false,
      'nova_confirmacao', false,
      'status', v_orcamento.formalizacao_status,
      'motivo', 'Reserva provisória ainda não foi criada.'
    );
  end if;

  select * into v_reserva
  from public.reservas
  where id = v_orcamento.reserva_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Reserva provisória não encontrada.';
  end if;

  select coalesce(contrato.status = 'Assinado', false)
  into v_contrato_assinado
  from public.contratos contrato
  where contrato.id = v_orcamento.contrato_id;

  select coalesce(lancamento.status = 'Pago', false)
  into v_sinal_pago
  from public.lancamentos_financeiros lancamento
  where lancamento.id = v_orcamento.lancamento_sinal_id;

  v_contrato_assinado := coalesce(v_contrato_assinado, false);
  v_sinal_pago := coalesce(v_sinal_pago, false);

  if not v_contrato_assinado or not v_sinal_pago then
    v_status := case
      when not v_contrato_assinado then 'AGUARDANDO_ASSINATURA'
      else 'AGUARDANDO_PAGAMENTO'
    end;

    update public.orcamentos
    set formalizacao_status = v_status,
        formalizacao_bloqueio = null
    where id = v_orcamento.id
      and formalizacao_status is distinct from 'RESERVA_CONFIRMADA';

    return jsonb_build_object(
      'confirmada', false,
      'nova_confirmacao', false,
      'status', v_status,
      'contrato_assinado', v_contrato_assinado,
      'sinal_pago', v_sinal_pago
    );
  end if;

  if v_reserva.status = 'Confirmada' then
    update public.orcamentos
    set formalizacao_status = 'RESERVA_CONFIRMADA',
        formalizacao_bloqueio = null,
        hold_expira_em = null,
        formalizado_em = coalesce(formalizado_em, now())
    where id = v_orcamento.id;

    return jsonb_build_object(
      'confirmada', true,
      'nova_confirmacao', false,
      'status', 'RESERVA_CONFIRMADA',
      'reserva_id', v_reserva.id,
      'contrato_assinado', true,
      'sinal_pago', true
    );
  end if;

  update public.orcamentos
  set formalizacao_status = 'PRONTA_PARA_CONFIRMAR',
      formalizacao_bloqueio = null
  where id = v_orcamento.id;

  for v_item in
    select distinct item.kit_id
    from public.orcamento_itens item
    where item.orcamento_id = v_orcamento.id
      and item.kit_id is not null
  loop
    v_disponibilidade := public.verificar_disponibilidade_kit_com_hold(
      v_item.kit_id,
      coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
      coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
      v_reserva.id,
      v_orcamento.id
    );

    if not coalesce((v_disponibilidade->>'disponivel')::boolean, false) then
      v_motivo := coalesce(
        v_disponibilidade->>'motivo',
        'A disponibilidade precisa ser revisada antes da confirmação.'
      );

      update public.orcamentos
      set formalizacao_bloqueio = v_motivo
      where id = v_orcamento.id;

      return jsonb_build_object(
        'confirmada', false,
        'nova_confirmacao', false,
        'status', 'PRONTA_PARA_CONFIRMAR',
        'bloqueada', true,
        'motivo', v_motivo,
        'contrato_assinado', true,
        'sinal_pago', true
      );
    end if;
  end loop;

  update public.reservas
  set status = 'Confirmada',
      status_comercial = 'Confirmada',
      status_operacional = 'Aguardando operação'
  where id = v_reserva.id
    and status is distinct from 'Confirmada';

  update public.orcamentos
  set formalizacao_status = 'RESERVA_CONFIRMADA',
      formalizacao_bloqueio = null,
      hold_expira_em = null,
      formalizado_em = coalesce(formalizado_em, now())
  where id = v_orcamento.id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set etapa = 'Fechado',
        motivo_perda = null
    where id = v_orcamento.oportunidade_id
      and etapa <> 'Perdido';
  end if;

  return jsonb_build_object(
    'confirmada', true,
    'nova_confirmacao', true,
    'status', 'RESERVA_CONFIRMADA',
    'reserva_id', v_reserva.id,
    'contrato_assinado', true,
    'sinal_pago', true
  );
end;
$$;

revoke all on function public.validar_confirmacao_reserva_formalizada()
from public, anon, authenticated, service_role;
revoke all on function public.tentar_confirmar_reserva_formalizada(uuid)
from public, anon, authenticated, service_role;
