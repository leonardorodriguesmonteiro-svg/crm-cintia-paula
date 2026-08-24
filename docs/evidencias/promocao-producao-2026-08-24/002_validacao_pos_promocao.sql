-- Executar em modo somente leitura após a promoção.

select column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'oportunidades' and column_name = 'etapa';

select etapa, count(*)
from public.oportunidades
group by etapa
order by etapa;

select column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'orcamentos' and column_name = 'status';

select status, formalizacao_status, count(*)
from public.orcamentos
group by status, formalizacao_status
order by status, formalizacao_status;

select indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'oportunidades_empresa_etapa_recebida_idx',
    'orcamentos_empresa_status_formalizacao_idx'
  )
order by indexname;

select proname, proconfig
from pg_proc
join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
where pg_namespace.nspname = 'public'
  and proname in (
    'normalizar_etapa_oportunidade',
    'normalizar_status_proposta_formalizacao',
    'executar_formalizacao_servidor'
  )
order by proname;
