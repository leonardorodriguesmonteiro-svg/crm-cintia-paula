-- Quarta entrega comercial: proposta pública e resposta do cliente.

alter table public.orcamentos
add column if not exists public_token uuid not null default gen_random_uuid();

alter table public.orcamentos
add column if not exists resposta_cliente text;

alter table public.orcamentos
add column if not exists respondido_por text;

alter table public.orcamentos
add column if not exists respondido_em timestamptz;

alter table public.orcamentos
add column if not exists resposta_observacao text;

create unique index if not exists orcamentos_public_token_unique
on public.orcamentos(public_token);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orcamentos_resposta_cliente_check'
  ) then
    alter table public.orcamentos
    add constraint orcamentos_resposta_cliente_check
    check (resposta_cliente is null or resposta_cliente in ('Aprovado', 'Recusado'));
  end if;
end;
$$;

create or replace function public.registrar_resposta_publica_orcamento(
  p_token uuid,
  p_decisao text,
  p_nome text,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_agora timestamptz := now();
begin
  if p_decisao not in ('Aprovado', 'Recusado') then
    raise exception 'Resposta inválida.';
  end if;

  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe o nome de quem está respondendo.';
  end if;

  select *
  into v_orcamento
  from public.orcamentos
  where public_token = p_token
  for update;

  if not found then
    raise exception 'Proposta não encontrada.';
  end if;

  if v_orcamento.status in ('Aprovado', 'Recusado') then
    return jsonb_build_object(
      'numero', v_orcamento.numero,
      'status', v_orcamento.status,
      'decisao', coalesce(v_orcamento.resposta_cliente, v_orcamento.status),
      'respondido_em', v_orcamento.respondido_em,
      'ja_respondido', true
    );
  end if;

  if v_orcamento.status = 'Expirado'
    or (
      v_orcamento.validade is not null
      and v_orcamento.validade < (now() at time zone 'America/Sao_Paulo')::date
    ) then
    update public.orcamentos
    set status = 'Expirado'
    where id = v_orcamento.id;

    raise exception 'Esta proposta está expirada. Entre em contato para solicitar uma atualização.';
  end if;

  if v_orcamento.status not in ('Rascunho', 'Enviado') then
    raise exception 'Esta proposta não aceita mais respostas.';
  end if;

  update public.orcamentos
  set status = p_decisao,
      resposta_cliente = p_decisao,
      respondido_por = left(trim(p_nome), 120),
      respondido_em = v_agora,
      resposta_observacao = nullif(left(trim(coalesce(p_observacao, '')), 1000), '')
  where id = v_orcamento.id;

  if v_orcamento.oportunidade_id is not null then
    if p_decisao = 'Aprovado' then
      update public.oportunidades
      set etapa = 'Negociação',
          motivo_perda = null
      where id = v_orcamento.oportunidade_id
        and etapa not in ('Fechado', 'Perdido');
    else
      update public.oportunidades
      set etapa = 'Perdido',
          motivo_perda = 'Orçamento recusado pelo cliente.'
      where id = v_orcamento.oportunidade_id
        and etapa <> 'Fechado';
    end if;
  end if;

  return jsonb_build_object(
    'numero', v_orcamento.numero,
    'status', p_decisao,
    'decisao', p_decisao,
    'respondido_em', v_agora,
    'ja_respondido', false
  );
end;
$$;

revoke all on function public.registrar_resposta_publica_orcamento(uuid, text, text, text)
from public;

grant execute on function public.registrar_resposta_publica_orcamento(uuid, text, text, text)
to service_role;
