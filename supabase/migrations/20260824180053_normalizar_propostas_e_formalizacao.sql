-- Consolida propostas e formalização nos estados da Jornada Comercial 1.1.
-- As RPCs financeiras antigas continuam encapsuladas pelo servidor durante a
-- transição, mas nenhum estado legado permanece salvo ao final da transação.

begin;

create or replace function public.normalizar_status_proposta_formalizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A Application Layer usa esta chave apenas dentro da mesma transação para
  -- chamar RPCs históricas que ainda validam o texto "Aprovado".
  if current_setting('app.permitir_status_comercial_legado', true) = 'true' then
    return new;
  end if;

  new.status := case new.status
    when 'Rascunho' then 'RASCUNHO'
    when 'Enviado' then 'ENVIADA'
    when 'Aprovado' then 'ACEITA'
    when 'Recusado' then 'RECUSADA'
    when 'Expirado' then 'EXPIRADA'
    else new.status
  end;

  new.resposta_cliente := case new.resposta_cliente
    when 'Aprovado' then 'ACEITA'
    when 'Recusado' then 'RECUSADA'
    else new.resposta_cliente
  end;

  new.formalizacao_status := case new.formalizacao_status
    when 'Aguardando formalização' then 'AGUARDANDO_DADOS'
    when 'Aguardando contrato' then 'AGUARDANDO_ASSINATURA'
    when 'Aguardando sinal' then 'AGUARDANDO_PAGAMENTO'
    when 'Venda confirmada' then 'RESERVA_CONFIRMADA'
    when 'Cancelada' then 'CANCELADA'
    else new.formalizacao_status
  end;

  if new.status = 'ACEITA' and new.formalizacao_status is null then
    new.formalizacao_status := 'AGUARDANDO_DADOS';
  elsif new.status in ('RECUSADA', 'EXPIRADA', 'CANCELADA')
    and new.formalizacao_status is distinct from 'RESERVA_CONFIRMADA'
  then
    new.formalizacao_status := 'CANCELADA';
  end if;

  return new;
end;
$$;

revoke all on function public.normalizar_status_proposta_formalizacao()
from public;

drop trigger if exists zz_normalizar_status_proposta_formalizacao
on public.orcamentos;

-- O prefixo zz garante que este normalizador rode depois do trigger histórico
-- sincronizar_status_formalizacao_orcamento.
create trigger zz_normalizar_status_proposta_formalizacao
before insert or update of status, resposta_cliente, formalizacao_status
on public.orcamentos
for each row execute function public.normalizar_status_proposta_formalizacao();

-- A confirmação da reserva permanece responsabilidade exclusiva da função
-- `tentar_confirmar_reserva_formalizada`, criada pelas migrações V2. Ela
-- revalida contrato, sinal e disponibilidade de estoque na mesma transação.
-- Não criamos aqui triggers concorrentes para essa passagem.

-- Encapsula as RPCs históricas. O estado legado existe apenas enquanto a
-- função antiga executa e é normalizado antes do commit.
create or replace function public.executar_formalizacao_servidor(
  p_usuario_id uuid,
  p_orcamento_id uuid,
  p_acao text,
  p_valor_sinal numeric default null,
  p_vencimento date default null,
  p_forma_pagamento text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil text;
  v_resultado jsonb;
begin
  select vinculo.perfil
  into v_perfil
  from public.usuarios_empresa vinculo
  where vinculo.usuario_id = p_usuario_id
    and vinculo.ativo = true
  order by case when vinculo.perfil = 'Administrador' then 0 else 1 end
  limit 1;

  if v_perfil is null then
    raise exception 'Usuário sem vínculo ativo com a empresa.';
  end if;

  if p_acao in ('formalizar', 'confirmar_assinatura')
    and v_perfil not in ('Administrador', 'Comercial')
  then
    raise exception 'Seu perfil não possui permissão para formalizar esta venda.';
  end if;

  if p_acao = 'confirmar_sinal'
    and v_perfil not in ('Administrador', 'Comercial', 'Financeiro')
  then
    raise exception 'Seu perfil não possui permissão para confirmar o sinal.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_usuario_id, 'role', 'authenticated')::text,
    true
  );

  if p_acao = 'formalizar' then
    if not exists (
      select 1
      from public.orcamentos orcamento
      where orcamento.id = p_orcamento_id
        and orcamento.status = 'ACEITA'
        and orcamento.formalizacao_status = 'DADOS_COMPLETOS'
    ) then
      raise exception 'A proposta precisa estar aceita e com os dados do cliente completos.';
    end if;

    perform set_config('app.permitir_status_comercial_legado', 'true', true);
    update public.orcamentos set status = 'Aprovado' where id = p_orcamento_id;
    v_resultado := public.formalizar_orcamento_aprovado(
      p_orcamento_id,
      p_valor_sinal,
      p_vencimento
    );
    perform set_config('app.permitir_status_comercial_legado', 'false', true);

    update public.orcamentos
    set status = 'ACEITA', formalizacao_status = 'AGUARDANDO_ASSINATURA'
    where id = p_orcamento_id;
  elsif p_acao = 'confirmar_assinatura' then
    v_resultado := public.confirmar_assinatura_formalizacao(p_orcamento_id);
  elsif p_acao = 'confirmar_sinal' then
    v_resultado := public.confirmar_pagamento_sinal_formalizacao(
      p_orcamento_id,
      p_forma_pagamento
    );
  else
    raise exception 'Ação de formalização inválida.';
  end if;

  select jsonb_build_object(
    'status', orcamento.formalizacao_status,
    'reserva_id', orcamento.reserva_id,
    'contrato_id', orcamento.contrato_id,
    'lancamento_sinal_id', orcamento.lancamento_sinal_id,
    'mensagem', case orcamento.formalizacao_status
      when 'AGUARDANDO_ASSINATURA' then 'Contrato e cobrança criados. Aguardando assinatura.'
      when 'AGUARDANDO_PAGAMENTO' then 'Contrato assinado. Aguardando pagamento do sinal.'
      when 'RESERVA_CONFIRMADA' then 'Formalização concluída e reserva confirmada.'
      else coalesce(v_resultado->>'mensagem', 'Formalização atualizada.')
    end
  )
  into v_resultado
  from public.orcamentos orcamento
  where orcamento.id = p_orcamento_id;

  return v_resultado;
end;
$$;

revoke all on function public.executar_formalizacao_servidor(uuid, uuid, text, numeric, date, text)
from public, anon, authenticated;

grant execute on function public.executar_formalizacao_servidor(uuid, uuid, text, numeric, date, text)
to service_role;

-- Normaliza o estoque histórico. A atualização também dispara a confirmação
-- das reservas que já tinham contrato e sinal concluídos.
update public.orcamentos
set
  status = status,
  resposta_cliente = resposta_cliente,
  formalizacao_status = formalizacao_status
where status in ('Rascunho', 'Enviado', 'Aprovado', 'Recusado', 'Expirado')
   or resposta_cliente in ('Aprovado', 'Recusado')
   or formalizacao_status in (
     'Aguardando formalização',
     'Aguardando contrato',
     'Aguardando sinal',
     'Venda confirmada',
     'Cancelada'
   );

alter table public.orcamentos
  alter column status set default 'RASCUNHO';

create index if not exists orcamentos_empresa_status_formalizacao_idx
on public.orcamentos (empresa_id, status, formalizacao_status, updated_at desc);

commit;
