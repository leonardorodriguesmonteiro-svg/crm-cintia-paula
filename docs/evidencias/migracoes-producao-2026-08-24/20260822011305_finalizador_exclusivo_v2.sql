-- Sprint Comercial 1.1 - Confirmação exclusiva pelo finalizador V2.
-- A existência de assinatura e pagamento não basta para atalhos legados:
-- o finalizador precisa revalidar todos os kits e marcar PRONTA_PARA_CONFIRMAR.

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
      'DADOS_COMPLETOS',
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

  if v_orcamento.formalizacao_status <> 'PRONTA_PARA_CONFIRMAR'
    or v_orcamento.formalizacao_bloqueio is not null
  then
    raise exception using
      errcode = '23514',
      message = 'A confirmação da reserva V2 deve ser executada pelo finalizador comercial após a revalidação de disponibilidade.';
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

revoke all on function public.validar_confirmacao_reserva_formalizada()
from public, anon, authenticated, service_role;
