-- Consolida a entrada comercial na jornada oficial sem apagar histórico.
--
-- Escopo desta etapa:
-- 1. converte todos os estados legados de oportunidades;
-- 2. impede que integrações antigas voltem a persistir estados legados;
-- 3. mantém propostas/formalização compatíveis até a modernização das RPCs
--    financeiras legadas.

begin;

-- Funções históricas ainda podem tentar gravar os nomes antigos. A tradução
-- ocorre antes das constraints e mantém essas integrações funcionando durante
-- a retirada gradual do código legado.
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

drop trigger if exists normalizar_etapa_oportunidade
on public.oportunidades;

create trigger normalizar_etapa_oportunidade
before insert or update of etapa on public.oportunidades
for each row execute function public.normalizar_etapa_oportunidade();

-- A presença de uma proposta é a evidência mais forte de que a oportunidade
-- já atravessou a análise comercial. Os demais estados são mapeados sem
-- inferir aceite, pagamento ou confirmação de reserva.
update public.oportunidades oportunidade
set etapa = case
  when exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.oportunidade_id = oportunidade.id
  ) then 'CONVERTIDA_EM_PROPOSTA'
  when oportunidade.etapa = 'Novo contato' then 'RECEBIDA'
  when oportunidade.etapa in (
    'Em atendimento',
    'Orçamento enviado',
    'Negociação',
    'Fechado'
  ) then 'EM_ANALISE'
  when oportunidade.etapa = 'Perdido' then 'RECUSADA'
  else oportunidade.etapa
end
where oportunidade.etapa in (
  'Novo contato',
  'Em atendimento',
  'Orçamento enviado',
  'Negociação',
  'Fechado',
  'Perdido'
);

alter table public.oportunidades
  alter column etapa set default 'RECEBIDA';

alter table public.oportunidades
  drop constraint if exists oportunidades_etapa_check;

alter table public.oportunidades
  add constraint oportunidades_etapa_check
  check (
    etapa in (
      'RECEBIDA',
      'EM_ANALISE',
      'AJUSTE_SOLICITADO',
      'APROVADA',
      'RECUSADA',
      'CONVERTIDA_EM_PROPOSTA'
    )
  ) not valid;

alter table public.oportunidades
  validate constraint oportunidades_etapa_check;

-- A consulta principal da nova esteira filtra por empresa, estado e data.
create index if not exists oportunidades_empresa_etapa_recebida_idx
on public.oportunidades (empresa_id, etapa, recebida_em desc);

commit;
