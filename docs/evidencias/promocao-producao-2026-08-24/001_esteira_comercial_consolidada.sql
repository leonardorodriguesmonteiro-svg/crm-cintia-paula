-- Promoção consolidada da Jornada Comercial 1.1 para produção.
-- Preparada a partir do schema de produção exportado em 2026-08-24.
-- Não substitui executar_formalizacao_servidor: produção já possui a versão
-- endurecida com isolamento por empresa e validação de e-mail.

begin;

-- Falha cedo se o alvo não tiver a base de produção analisada.
do $$
declare
  v_formalizacao text;
begin
  if to_regclass('public.oportunidades') is null
     or to_regclass('public.orcamentos') is null
     or to_regclass('public.empresas') is null then
    raise exception 'Schema alvo incompatível com a promoção da Jornada Comercial 1.1.';
  end if;

  select pg_get_functiondef(
    'public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text)'::regprocedure
  ) into v_formalizacao;

  if position('v_empresa_id' in v_formalizacao) = 0
     or position('v_email_cliente' in v_formalizacao) = 0 then
    raise exception 'A função endurecida de formalização não foi encontrada; promoção interrompida.';
  end if;
end;
$$;

create or replace function public.normalizar_etapa_oportunidade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.etapa := case new.etapa
    when 'Novo contato' then 'RECEBIDA'
    when 'Em atendimento' then 'EM_ANALISE'
    when 'Orçamento enviado' then 'CONVERTIDA_EM_PROPOSTA'
    when 'Negociação' then 'CONVERTIDA_EM_PROPOSTA'
    when 'Fechado' then 'CONVERTIDA_EM_PROPOSTA'
    when 'Perdido' then 'RECUSADA'
    else new.etapa
  end;
  return new;
end;
$$;

revoke all on function public.normalizar_etapa_oportunidade() from public;

drop trigger if exists normalizar_etapa_oportunidade on public.oportunidades;
create trigger normalizar_etapa_oportunidade
before insert or update of etapa on public.oportunidades
for each row execute function public.normalizar_etapa_oportunidade();

update public.oportunidades oportunidade
set etapa = case
  when exists (
    select 1 from public.orcamentos orcamento
    where orcamento.oportunidade_id = oportunidade.id
  ) then 'CONVERTIDA_EM_PROPOSTA'
  when oportunidade.etapa = 'Novo contato' then 'RECEBIDA'
  when oportunidade.etapa in ('Em atendimento', 'Orçamento enviado', 'Negociação', 'Fechado')
    then 'EM_ANALISE'
  when oportunidade.etapa = 'Perdido' then 'RECUSADA'
  else oportunidade.etapa
end
where oportunidade.etapa in (
  'Novo contato', 'Em atendimento', 'Orçamento enviado',
  'Negociação', 'Fechado', 'Perdido'
);

alter table public.oportunidades alter column etapa set default 'RECEBIDA';
alter table public.oportunidades drop constraint if exists oportunidades_etapa_check;
alter table public.oportunidades add constraint oportunidades_etapa_check
check (etapa in (
  'RECEBIDA', 'EM_ANALISE', 'AJUSTE_SOLICITADO',
  'APROVADA', 'RECUSADA', 'CONVERTIDA_EM_PROPOSTA'
)) not valid;
alter table public.oportunidades validate constraint oportunidades_etapa_check;

create index if not exists oportunidades_empresa_etapa_recebida_idx
on public.oportunidades (empresa_id, etapa, recebida_em desc);

create or replace function public.normalizar_status_proposta_formalizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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
    and new.formalizacao_status is distinct from 'RESERVA_CONFIRMADA' then
    new.formalizacao_status := 'CANCELADA';
  end if;
  return new;
end;
$$;

revoke all on function public.normalizar_status_proposta_formalizacao() from public;

drop trigger if exists zz_normalizar_status_proposta_formalizacao on public.orcamentos;
create trigger zz_normalizar_status_proposta_formalizacao
before insert or update of status, resposta_cliente, formalizacao_status
on public.orcamentos
for each row execute function public.normalizar_status_proposta_formalizacao();

update public.orcamentos
set status = status,
    resposta_cliente = resposta_cliente,
    formalizacao_status = formalizacao_status
where status in ('Rascunho', 'Enviado', 'Aprovado', 'Recusado', 'Expirado')
   or resposta_cliente in ('Aprovado', 'Recusado')
   or formalizacao_status in (
     'Aguardando formalização', 'Aguardando contrato', 'Aguardando sinal',
     'Venda confirmada', 'Cancelada'
   );

alter table public.orcamentos alter column status set default 'RASCUNHO';
create index if not exists orcamentos_empresa_status_formalizacao_idx
on public.orcamentos (empresa_id, status, formalizacao_status, updated_at desc);

-- Compatibilidade da instalação-base.
alter table public.empresas add column if not exists status text;
update public.empresas set status = 'Ativa' where status is null or btrim(status) = '';
alter table public.empresas
  alter column status set default 'Ativa',
  alter column status set not null;

-- Hardening de funções internas expostas pela Data API.
revoke execute on function public.auditar_empresa() from public, anon;
revoke execute on function public.auditar_entidade_operacional() from public, anon;
revoke execute on function public.auditar_evidence_engine() from public, anon;
revoke execute on function public.auditar_usuario_empresa() from public, anon;
revoke execute on function public.garantir_administrador_inicial() from public, anon;
revoke execute on function public.gerar_codigo_automatico_estoque() from public, anon;
revoke execute on function public.meu_acesso() from public, anon;
revoke execute on function public.recalcular_orcamento_por_itens() from public, anon;
revoke execute on function public.recalcular_reserva_por_itens() from public, anon;
revoke execute on function public.registrar_preferencia_mercado_pago(uuid, text, text) from public, anon;
revoke execute on function public.registrar_timeline_assinatura_missao() from public, anon;
revoke execute on function public.registrar_timeline_evidencia_missao() from public, anon;
revoke execute on function public.registrar_timeline_ocorrencia_missao() from public, anon;
revoke execute on function public.usuario_eh_admin_empresa(uuid) from public, anon;
revoke execute on function public.usuario_eh_administrador() from public, anon;
revoke execute on function public.usuario_pertence_empresa(uuid) from public, anon;
revoke execute on function public.usuario_tem_perfil(text[]) from public, anon;
revoke execute on function public.usuario_tem_permissao(text) from public, anon;

alter function public.registrar_timeline_reserva_criada() set search_path = public;
alter function public.registrar_timeline_reserva_editada() set search_path = public;
alter function public.registrar_timeline_recebimento() set search_path = public;
alter function public.bloquear_reserva_duplicada_kit_data() set search_path = public;

commit;
