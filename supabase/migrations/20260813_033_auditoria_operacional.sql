-- Sprint Administracao 1.0: auditoria operacional centralizada.

create index if not exists auditoria_logs_empresa_entidade_data_idx
on public.auditoria_logs (empresa_id, entidade, created_at desc);

create index if not exists auditoria_logs_empresa_acao_data_idx
on public.auditoria_logs (empresa_id, acao, created_at desc);

create or replace function public.auditar_entidade_operacional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_usuario_id uuid := auth.uid();
  v_registro jsonb;
  v_anterior jsonb;
  v_novo jsonb;
  v_entidade_id text;
  v_acao text;
begin
  if tg_op = 'DELETE' then
    v_registro := to_jsonb(old);
    v_anterior := v_registro;
    v_acao := 'EXCLUIR';
  elsif tg_op = 'INSERT' then
    v_registro := to_jsonb(new);
    v_novo := v_registro;
    v_acao := 'CRIAR';
  else
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    v_registro := to_jsonb(new);
    v_anterior := to_jsonb(old);
    v_novo := to_jsonb(new);
    v_acao := 'ATUALIZAR';
  end if;

  if coalesce(v_registro ->> 'empresa_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_empresa_id := (v_registro ->> 'empresa_id')::uuid;
  end if;

  if v_empresa_id is null and v_usuario_id is not null then
    select vinculo.empresa_id
      into v_empresa_id
    from public.usuarios_empresa vinculo
    where vinculo.usuario_id = v_usuario_id
      and vinculo.ativo = true
    order by case when vinculo.perfil = 'Administrador' then 0 else 1 end, vinculo.created_at
    limit 1;
  end if;

  -- As rotinas de servidor nao possuem auth.uid(). No ambiente de empresa unica,
  -- preservamos o evento identificando o autor como Sistema / Automacao.
  if v_empresa_id is null and (select count(*) from public.empresas) = 1 then
    select id into v_empresa_id from public.empresas limit 1;
  end if;

  -- A ausencia de contexto empresarial nunca pode interromper uma operacao do ERP.
  if v_empresa_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_entidade_id := coalesce(
    v_registro ->> 'id',
    v_registro ->> 'codigo',
    v_registro ->> 'token'
  );

  -- Campos de autenticacao, pagamento e assinatura nao devem ser copiados para o log.
  v_anterior := v_anterior - array[
    'access_token', 'refresh_token', 'webhook_secret', 'senha', 'password',
    'assinatura_documento', 'assinatura_ip_hash', 'assinatura_user_agent',
    'mercado_pago_payload', 'pix_copia_cola'
  ];
  v_novo := v_novo - array[
    'access_token', 'refresh_token', 'webhook_secret', 'senha', 'password',
    'assinatura_documento', 'assinatura_ip_hash', 'assinatura_user_agent',
    'mercado_pago_payload', 'pix_copia_cola'
  ];

  insert into public.auditoria_logs (
    empresa_id,
    usuario_id,
    entidade,
    entidade_id,
    acao,
    dados_anteriores,
    dados_novos
  ) values (
    v_empresa_id,
    v_usuario_id,
    tg_table_name,
    v_entidade_id,
    v_acao,
    v_anterior,
    v_novo
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Padroniza tambem os eventos ja existentes de empresa.
create or replace function public.auditar_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  insert into public.auditoria_logs (
    empresa_id,
    usuario_id,
    entidade,
    entidade_id,
    acao,
    dados_anteriores,
    dados_novos
  ) values (
    coalesce(new.id, old.id),
    auth.uid(),
    'empresas',
    coalesce(new.id, old.id)::text,
    case tg_op when 'INSERT' then 'CRIAR' when 'DELETE' then 'EXCLUIR' else 'ATUALIZAR' end,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  v_tabela text;
  v_tabelas text[] := array[
    'clientes',
    'estoque_itens',
    'kits',
    'kit_composicao',
    'reservas',
    'reserva_itens',
    'oportunidades',
    'orcamentos',
    'orcamento_itens',
    'contratos',
    'lancamentos_financeiros',
    'recebimentos',
    'feedbacks',
    'configuracoes_pagamento',
    'ordens_servico',
    'ordem_servico_itens',
    'equipe',
    'ordem_servico_equipe',
    'reserva_checklist',
    'reserva_logistica',
    'conferencias',
    'conferencia_itens',
    'movimentos_estoque',
    'despesas'
  ];
begin
  foreach v_tabela in array v_tabelas loop
    if to_regclass(format('public.%I', v_tabela)) is not null then
      execute format('drop trigger if exists auditar_operacao on public.%I', v_tabela);
      execute format(
        'create trigger auditar_operacao after insert or update or delete on public.%I for each row execute function public.auditar_entidade_operacional()',
        v_tabela
      );
    end if;
  end loop;
end $$;
