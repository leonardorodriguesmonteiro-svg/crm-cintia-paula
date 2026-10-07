-- Jornada Simplificada 3.0 — Sprint 0
-- Portão de invariantes somente leitura.
-- Executar antes e depois de cada migration, sem alterar dados ou schema.

with core_counts as (
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
), orphan_counts as (
  select jsonb_build_object(
    'orcamento_itens_sem_orcamento', (
      select count(*) from public.orcamento_itens i
      left join public.orcamentos o on o.id = i.orcamento_id
      where o.id is null
    ),
    'oportunidade_itens_sem_oportunidade', (
      select count(*) from public.oportunidade_itens i
      left join public.oportunidades o on o.id = i.oportunidade_id
      where o.id is null
    ),
    'reservas_sem_cliente', (
      select count(*) from public.reservas r
      left join public.clientes c on c.id = r.cliente_id
      where r.cliente_id is not null and c.id is null
    ),
    'reservas_sem_kit', (
      select count(*) from public.reservas r
      left join public.kits k on k.id = r.kit_id
      where r.kit_id is not null and k.id is null
    ),
    'contratos_sem_reserva', (
      select count(*) from public.contratos c
      left join public.reservas r on r.id = c.reserva_id
      where c.reserva_id is not null and r.id is null
    )
  ) as value
), tenant_mismatches as (
  select jsonb_build_object(
    'orcamento_oportunidade', (
      select count(*) from public.orcamentos o
      join public.oportunidades op on op.id = o.oportunidade_id
      where o.empresa_id is distinct from op.empresa_id
    )
  ) as value
), duplicate_documents as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'empresa_id', empresa_id,
    'documento', documento,
    'quantidade', quantidade
  ) order by empresa_id, documento), '[]'::jsonb) as value
  from (
    select null::uuid empresa_id,
           regexp_replace(coalesce(cpf, ''), '\D', '', 'g') documento,
           count(*) quantidade
    from public.clientes
    where nullif(regexp_replace(coalesce(cpf, ''), '\D', '', 'g'), '') is not null
    group by regexp_replace(coalesce(cpf, ''), '\D', '', 'g')
    having count(*) > 1
  ) duplicates
), photos as (
  select jsonb_build_object(
    'kits_com_foto', (select count(*) from public.kits where nullif(foto_url, '') is not null),
    'estoque_com_foto', (select count(*) from public.estoque_itens where nullif(foto_url, '') is not null),
    'storage_por_bucket', (
      select coalesce(jsonb_object_agg(bucket_id, quantidade order by bucket_id), '{}'::jsonb)
      from (
        select bucket_id, count(*) quantidade
        from storage.objects
        group by bucket_id
      ) buckets
    )
  ) as value
), statuses as (
  select jsonb_build_object(
    'oportunidades', (
      select coalesce(jsonb_object_agg(etapa, quantidade order by etapa), '{}'::jsonb)
      from (select coalesce(etapa, '<NULL>') etapa, count(*) quantidade
            from public.oportunidades group by coalesce(etapa, '<NULL>')) values_by_status
    ),
    'orcamentos', (
      select coalesce(jsonb_object_agg(status, quantidade order by status), '{}'::jsonb)
      from (select coalesce(status, '<NULL>') status, count(*) quantidade
            from public.orcamentos group by coalesce(status, '<NULL>')) values_by_status
    ),
    'reservas', (
      select coalesce(jsonb_object_agg(status, quantidade order by status), '{}'::jsonb)
      from (select coalesce(status, '<NULL>') status, count(*) quantidade
            from public.reservas group by coalesce(status, '<NULL>')) values_by_status
    ),
    'contratos', (
      select coalesce(jsonb_object_agg(status, quantidade order by status), '{}'::jsonb)
      from (select coalesce(status, '<NULL>') status, count(*) quantidade
            from public.contratos group by coalesce(status, '<NULL>')) values_by_status
    )
  ) as value
), rls as (
  select jsonb_build_object(
    'public_tables', count(*),
    'rls_enabled', count(*) filter (where c.relrowsecurity),
    'rls_disabled', coalesce(jsonb_agg(c.relname order by c.relname)
      filter (where not c.relrowsecurity), '[]'::jsonb)
  ) as value
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
)
select jsonb_build_object(
  'captured_at_utc', timezone('utc', now()),
  'core_counts', (select value from core_counts),
  'orphans', (select value from orphan_counts),
  'tenant_mismatches', (select value from tenant_mismatches),
  'duplicate_documents', (select value from duplicate_documents),
  'photos', (select value from photos),
  'statuses', (select value from statuses),
  'rls', (select value from rls)
) as invariants;
