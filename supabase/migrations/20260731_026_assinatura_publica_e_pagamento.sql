-- Sexta entrega comercial: assinatura pública e instruções automáticas do sinal.

alter table public.contratos
add column if not exists public_token uuid not null default gen_random_uuid();

alter table public.contratos
add column if not exists assinado_em timestamptz;

alter table public.contratos
add column if not exists assinado_por text;

alter table public.contratos
add column if not exists assinatura_documento text;

alter table public.contratos
add column if not exists assinatura_ip_hash text;

alter table public.contratos
add column if not exists assinatura_user_agent text;

alter table public.contratos
add column if not exists assinatura_aceite boolean not null default false;

create unique index if not exists contratos_public_token_unique
on public.contratos(public_token);

create table if not exists public.configuracoes_pagamento (
  id boolean primary key default true check (id),
  pix_chave text,
  pix_beneficiario text,
  pix_cidade text,
  link_pagamento text,
  instrucoes text,
  updated_at timestamptz not null default now()
);

alter table public.configuracoes_pagamento enable row level security;

drop policy if exists "auth configuracoes_pagamento" on public.configuracoes_pagamento;
create policy "auth configuracoes_pagamento"
on public.configuracoes_pagamento for all to authenticated
using (true) with check (true);

insert into public.configuracoes_pagamento (id, pix_beneficiario, pix_cidade, instrucoes)
values (
  true,
  'Cintia Paula',
  'Rio de Janeiro',
  'Após o pagamento, envie o comprovante para a equipe Cintia Paula.'
)
on conflict (id) do nothing;

create or replace function public.preencher_auditoria_assinatura_contrato()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'Assinado' and old.status is distinct from 'Assinado' then
    new.assinado_em := coalesce(new.assinado_em, now());
    new.assinado_por := coalesce(new.assinado_por, 'Confirmado pela equipe');
  end if;

  return new;
end;
$$;

drop trigger if exists preencher_auditoria_assinatura_contrato
on public.contratos;

create trigger preencher_auditoria_assinatura_contrato
before update of status on public.contratos
for each row execute function public.preencher_auditoria_assinatura_contrato();

update public.contratos
set assinado_em = coalesce(assinado_em, created_at, now()),
    assinado_por = coalesce(assinado_por, 'Confirmação interna anterior')
where status = 'Assinado'
  and assinado_em is null;

create or replace function public.registrar_assinatura_publica_contrato(
  p_token uuid,
  p_nome text,
  p_documento text,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contrato public.contratos%rowtype;
  v_orcamento public.orcamentos%rowtype;
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_documento_cliente text;
  v_sinal_pago boolean := false;
  v_status text;
  v_agora timestamptz := now();
begin
  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe o nome completo do contratante.';
  end if;

  if length(v_documento) not in (11, 14) then
    raise exception 'Informe um CPF ou CNPJ válido.';
  end if;

  select contrato.*
  into v_contrato
  from public.contratos contrato
  where contrato.public_token = p_token
  for update;

  if not found then
    raise exception 'Contrato não encontrado.';
  end if;

  if v_contrato.status = 'Cancelado' then
    raise exception 'Este contrato foi cancelado e não aceita assinatura.';
  end if;

  if v_contrato.status = 'Assinado' then
    return jsonb_build_object(
      'status', 'Assinado',
      'assinado_em', v_contrato.assinado_em,
      'ja_assinado', true,
      'mensagem', 'Este contrato já foi assinado.'
    );
  end if;

  select regexp_replace(coalesce(cliente.cpf, ''), '\D', '', 'g')
  into v_documento_cliente
  from public.reservas reserva
  join public.clientes cliente on cliente.id = reserva.cliente_id
  where reserva.id = v_contrato.reserva_id;

  if length(coalesce(v_documento_cliente, '')) in (11, 14)
    and v_documento_cliente <> v_documento then
    raise exception 'O CPF ou CNPJ não corresponde ao contratante desta reserva.';
  end if;

  update public.contratos
  set status = 'Assinado',
      assinado_em = v_agora,
      assinado_por = left(trim(p_nome), 120),
      assinatura_documento = v_documento,
      assinatura_ip_hash = nullif(left(trim(coalesce(p_ip_hash, '')), 128), ''),
      assinatura_user_agent = nullif(left(trim(coalesce(p_user_agent, '')), 500), ''),
      assinatura_aceite = true,
      observacoes = concat_ws(
        E'\n',
        observacoes,
        'Aceite eletrônico registrado em ' ||
          to_char(v_agora at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') ||
          ' por ' || left(trim(p_nome), 120) || '.'
      )
  where id = v_contrato.id;

  update public.contrato_versoes
  set status = 'Assinado'
  where contrato_id = v_contrato.id;

  select *
  into v_orcamento
  from public.orcamentos
  where contrato_id = v_contrato.id
  for update;

  if found then
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
        contrato_assinado_em = coalesce(contrato_assinado_em, v_agora),
        formalizado_em = case when v_status = 'Venda confirmada' then v_agora else formalizado_em end
    where id = v_orcamento.id;

    if v_status = 'Venda confirmada' and v_orcamento.oportunidade_id is not null then
      update public.oportunidades
      set etapa = 'Fechado'
      where id = v_orcamento.oportunidade_id
        and etapa <> 'Perdido';
    end if;
  else
    v_status := 'Assinado';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'assinado_em', v_agora,
    'ja_assinado', false,
    'mensagem', case when v_status = 'Venda confirmada'
      then 'Contrato assinado e venda confirmada.'
      else 'Contrato assinado. Consulte abaixo as instruções para o sinal.'
    end
  );
end;
$$;

revoke all on function public.registrar_assinatura_publica_contrato(uuid, text, text, text, text)
from public;

revoke all on function public.preencher_auditoria_assinatura_contrato()
from public;

grant execute on function public.registrar_assinatura_publica_contrato(uuid, text, text, text, text)
to service_role;
