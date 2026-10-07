-- Jornada Simplificada 3.0 — Sprint 0
-- Inventário somente leitura. Não altera dados nem schema.

with key_counts as (
  select jsonb_build_object(
    'clientes', (select count(*) from public.clientes),
    'kits', (select count(*) from public.kits),
    'estoque_itens', (select count(*) from public.estoque_itens),
    'reservas', (select count(*) from public.reservas),
    'contratos', (select count(*) from public.contratos),
    'orcamentos', (select count(*) from public.orcamentos),
    'orcamento_itens', (select count(*) from public.orcamento_itens),
    'oportunidades', (select count(*) from public.oportunidades),
    'oportunidade_itens', (select count(*) from public.oportunidade_itens),
    'auditoria_logs', (select count(*) from public.auditoria_logs),
    'auth_users', (select count(*) from auth.users),
    'storage_objects', (select count(*) from storage.objects)
  ) as value
),
schema_signature as (
  select md5(string_agg(
    table_schema || '.' || table_name || '.' || column_name || ':' ||
    data_type || ':' || is_nullable || ':' || coalesce(column_default, ''),
    E'\n' order by table_schema, table_name, ordinal_position
  )) as value
  from information_schema.columns
  where table_schema in ('public', 'auth', 'storage')
),
object_counts as (
  select jsonb_build_object(
    'public_tables', (
      select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    ),
    'public_views', (
      select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('v', 'm')
    ),
    'public_functions', (
      select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
    ),
    'public_rls_tables', (
      select count(*)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    ),
    'public_policies', (
      select count(*) from pg_policies where schemaname = 'public'
    ),
    'public_triggers', (
      select count(*)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal
    )
  ) as value
),
storage_inventory as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket_id', b.id,
    'public', b.public,
    'objects', coalesce(o.objects, 0),
    'bytes', coalesce(o.bytes, 0)
  ) order by b.id), '[]'::jsonb) as value
  from storage.buckets b
  left join (
    select
      bucket_id,
      count(*) as objects,
      coalesce(sum((metadata ->> 'size')::bigint), 0) as bytes
    from storage.objects
    group by bucket_id
  ) o on o.bucket_id = b.id
)
select jsonb_build_object(
  'captured_at_utc', timezone('utc', now()),
  'database', current_database(),
  'postgres_version', current_setting('server_version'),
  'schema_signature_md5', (select value from schema_signature),
  'object_counts', (select value from object_counts),
  'key_counts', (select value from key_counts),
  'storage', (select value from storage_inventory)
) as baseline;
