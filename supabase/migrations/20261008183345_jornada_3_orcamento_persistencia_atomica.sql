-- Jornada Simplificada 3.0 — persistência atômica do orçamento.
--
-- A função desta migration é uma fronteira de aplicação server-only. Ela
-- grava cabeçalho, itens e taxas na mesma transação, aplica concorrência
-- otimista e preserva autoria para os gatilhos de auditoria.

alter table public.orcamentos
  add column if not exists origem_externa_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orcamentos'::regclass
      and conname = 'orcamentos_origem_externa_id_jornada3_check'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_origem_externa_id_jornada3_check
      check (
        origem_externa_id is null
        or length(trim(origem_externa_id)) between 1 and 200
      ) not valid;
  end if;
end;
$$;

alter table public.orcamentos
  validate constraint orcamentos_origem_externa_id_jornada3_check;

create unique index if not exists orcamentos_empresa_origem_externa_jornada3_unique
  on public.orcamentos (empresa_id, origem_externa_id)
  where origem_externa_id is not null;

create or replace function public.salvar_orcamento_jornada3_servidor(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_orcamento_id uuid,
  p_versao_esperada integer,
  p_idempotencia text,
  p_status text,
  p_origem text,
  p_cliente_id uuid,
  p_contato_nome text,
  p_contato_telefone text,
  p_contato_email text,
  p_tema_evento text,
  p_data_evento date,
  p_horario_evento text,
  p_data_retirada date,
  p_horario_retirada time without time zone,
  p_data_devolucao date,
  p_endereco_evento text,
  p_observacoes text,
  p_desconto_tipo text,
  p_desconto_valor numeric,
  p_itens jsonb,
  p_taxas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_existente public.orcamentos%rowtype;
  v_item record;
  v_taxa record;
  v_status text := upper(trim(coalesce(p_status, 'NOVO')));
  v_status_anterior text;
  v_origem text := upper(trim(coalesce(p_origem, 'MANUAL')));
  v_desconto_tipo text := upper(trim(coalesce(p_desconto_tipo, 'VALOR')));
  v_idempotencia text := nullif(trim(p_idempotencia), '');
  v_preco_base numeric(12, 2);
  v_preco_negociado numeric(12, 2);
  v_descricao text;
  v_quantidade numeric(10, 2);
  v_desconto_item numeric(12, 2);
  v_criado boolean := false;
  v_possui_conceitual boolean := false;
begin
  if p_empresa_id is null or p_usuario_id is null then
    raise exception using
      message = 'Empresa e usuário são obrigatórios.',
      errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.usuarios_empresa vinculo
    where vinculo.empresa_id = p_empresa_id
      and vinculo.usuario_id = p_usuario_id
      and vinculo.ativo = true
      and vinculo.perfil in ('Administrador', 'Comercial')
  ) then
    raise exception using
      message = 'Usuário sem permissão comercial nesta empresa.',
      errcode = '42501';
  end if;

  -- A role de serviço não possui auth.uid(); a claim local só é definida
  -- depois da validação do vínculo e permite que a auditoria guarde o ator.
  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    p_usuario_id::text,
    true
  );

  if v_status not in ('NOVO', 'EM_EDICAO', 'FINALIZADO', 'CANCELADO') then
    raise exception using
      message = 'Status do orçamento inválido.',
      errcode = '22023';
  end if;

  if v_origem not in (
    'SITE', 'MANUAL', 'WHATSAPP', 'INSTAGRAM', 'TELEFONE', 'INDICACAO', 'OUTRO'
  ) then
    raise exception using
      message = 'Origem do orçamento inválida.',
      errcode = '22023';
  end if;

  if v_desconto_tipo not in ('VALOR', 'PERCENTUAL')
    or coalesce(p_desconto_valor, 0) < 0
    or (v_desconto_tipo = 'PERCENTUAL' and coalesce(p_desconto_valor, 0) > 100)
  then
    raise exception using
      message = 'Desconto do orçamento inválido.',
      errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) > 100
  then
    raise exception using
      message = 'Itens do orçamento inválidos.',
      errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_taxas, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_taxas, '[]'::jsonb)) > 50
  then
    raise exception using
      message = 'Taxas do orçamento inválidas.',
      errcode = '22023';
  end if;

  if v_status = 'FINALIZADO' and (
    jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) = 0
    or length(trim(coalesce(p_contato_nome, ''))) < 2
    or length(regexp_replace(coalesce(p_contato_telefone, ''), '\D', '', 'g')) not between 10 and 11
    or p_data_evento is null
  ) then
    raise exception using
      message = 'Orçamento finalizado exige cliente, telefone, data e ao menos um item.',
      errcode = '22023';
  end if;

  if p_data_retirada is not null and p_data_devolucao is not null
    and p_data_retirada > p_data_devolucao
  then
    raise exception using
      message = 'A devolução não pode ocorrer antes da retirada.',
      errcode = '22023';
  end if;

  if p_orcamento_id is null then
    if v_idempotencia is null then
      raise exception using
        message = 'A chave de idempotência é obrigatória na criação.',
        errcode = '22023';
    end if;

    if length(v_idempotencia) > 200 then
      raise exception using
        message = 'A chave de idempotência é muito longa.',
        errcode = '22023';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_empresa_id::text || ':' || v_idempotencia, 0)
    );

    select *
      into v_existente
    from public.orcamentos
    where empresa_id = p_empresa_id
      and origem_externa_id = v_idempotencia;

    if found then
      return jsonb_build_object(
        'id', v_existente.id,
        'numero', v_existente.numero,
        'status_anterior', v_existente.status,
        'status', v_existente.status,
        'versao', v_existente.versao,
        'subtotal', v_existente.subtotal,
        'desconto', v_existente.desconto,
        'total_taxas', v_existente.total_taxas,
        'total', v_existente.total,
        'criado', false,
        'alterado', false,
        'possui_item_conceitual', exists (
          select 1 from public.orcamento_itens item
          where item.orcamento_id = v_existente.id
            and item.item_conceitual_id is not null
        )
      );
    end if;

    insert into public.orcamentos (
      empresa_id,
      cliente_id,
      status,
      origem,
      origem_externa_id,
      contato_nome,
      contato_telefone,
      contato_email,
      tema_evento,
      data_evento,
      horario_evento,
      data_retirada,
      horario_retirada,
      data_devolucao,
      endereco_evento,
      observacoes,
      desconto_tipo,
      desconto_valor,
      versao,
      created_by
    ) values (
      p_empresa_id,
      p_cliente_id,
      v_status,
      v_origem,
      v_idempotencia,
      nullif(trim(p_contato_nome), ''),
      nullif(regexp_replace(coalesce(p_contato_telefone, ''), '\D', '', 'g'), ''),
      nullif(lower(trim(p_contato_email)), ''),
      nullif(trim(p_tema_evento), ''),
      p_data_evento,
      nullif(trim(p_horario_evento), ''),
      p_data_retirada,
      p_horario_retirada,
      p_data_devolucao,
      nullif(trim(p_endereco_evento), ''),
      nullif(trim(p_observacoes), ''),
      v_desconto_tipo,
      coalesce(p_desconto_valor, 0),
      1,
      p_usuario_id
    )
    returning * into v_orcamento;

    v_criado := true;
    v_status_anterior := null;
  else
    select *
      into v_orcamento
    from public.orcamentos
    where id = p_orcamento_id
      and empresa_id = p_empresa_id
    for update;

    if not found then
      raise exception using
        message = 'Orçamento não encontrado para esta empresa.',
        errcode = 'P0002';
    end if;

    if p_versao_esperada is null or v_orcamento.versao <> p_versao_esperada then
      raise exception using
        message = 'O orçamento foi alterado por outra sessão. Atualize os dados e tente novamente.',
        errcode = '40001';
    end if;

    v_status_anterior := v_orcamento.status;

    if v_orcamento.status = 'CANCELADO' and v_status <> 'CANCELADO' then
      raise exception using
        message = 'Um orçamento cancelado não pode ser reaberto.',
        errcode = '22023';
    end if;

    if v_orcamento.status in ('NOVO', 'EM_EDICAO', 'FINALIZADO')
      and v_status <> v_orcamento.status
      and not (
        (v_orcamento.status = 'NOVO' and v_status in ('EM_EDICAO', 'CANCELADO'))
        or (v_orcamento.status = 'EM_EDICAO' and v_status in ('FINALIZADO', 'CANCELADO'))
        or (v_orcamento.status = 'FINALIZADO' and v_status in ('EM_EDICAO', 'CANCELADO'))
      )
    then
      raise exception using
        message = 'Transição de status do orçamento não permitida.',
        errcode = '22023';
    end if;

    update public.orcamentos
    set
      cliente_id = p_cliente_id,
      status = v_status,
      origem = v_origem,
      origem_externa_id = coalesce(v_idempotencia, origem_externa_id),
      contato_nome = nullif(trim(p_contato_nome), ''),
      contato_telefone = nullif(regexp_replace(coalesce(p_contato_telefone, ''), '\D', '', 'g'), ''),
      contato_email = nullif(lower(trim(p_contato_email)), ''),
      tema_evento = nullif(trim(p_tema_evento), ''),
      data_evento = p_data_evento,
      horario_evento = nullif(trim(p_horario_evento), ''),
      data_retirada = p_data_retirada,
      horario_retirada = p_horario_retirada,
      data_devolucao = p_data_devolucao,
      endereco_evento = nullif(trim(p_endereco_evento), ''),
      observacoes = nullif(trim(p_observacoes), ''),
      desconto_tipo = v_desconto_tipo,
      desconto_valor = coalesce(p_desconto_valor, 0),
      versao = versao + 1
    where id = v_orcamento.id
    returning * into v_orcamento;

    delete from public.orcamento_itens where orcamento_id = v_orcamento.id;
    delete from public.orcamento_taxas where orcamento_id = v_orcamento.id;
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as item(
      tipo_origem text,
      kit_id uuid,
      estoque_item_id uuid,
      item_conceitual_id uuid,
      descricao text,
      quantidade numeric,
      preco_base numeric,
      preco_unitario_orcamento numeric,
      desconto numeric,
      observacao text,
      ordem integer
    )
  loop
    v_quantidade := coalesce(v_item.quantidade, 0);
    v_desconto_item := coalesce(v_item.desconto, 0);

    if upper(coalesce(v_item.tipo_origem, '')) not in (
      'KIT', 'ESTOQUE', 'LIVRE', 'CONCEITUAL'
    ) or v_quantidade <= 0 then
      raise exception using
        message = 'Tipo ou quantidade de item inválido.',
        errcode = '22023';
    end if;

    case upper(v_item.tipo_origem)
      when 'KIT' then
        if v_item.kit_id is null
          or v_item.estoque_item_id is not null
          or v_item.item_conceitual_id is not null then
          raise exception using message = 'Referência de kit inválida.', errcode = '22023';
        end if;
        select nome, greatest(coalesce(valor, 0), 0)
          into v_descricao, v_preco_base
        from public.kits
        where id = v_item.kit_id;
      when 'ESTOQUE' then
        if v_item.estoque_item_id is null
          or v_item.kit_id is not null
          or v_item.item_conceitual_id is not null then
          raise exception using message = 'Referência de estoque inválida.', errcode = '22023';
        end if;
        select nome, greatest(coalesce(valor_reposicao, 0), 0)
          into v_descricao, v_preco_base
        from public.estoque_itens
        where id = v_item.estoque_item_id;
      when 'CONCEITUAL' then
        if v_item.item_conceitual_id is null
          or v_item.kit_id is not null
          or v_item.estoque_item_id is not null then
          raise exception using message = 'Referência de item conceitual inválida.', errcode = '22023';
        end if;
        select nome, greatest(coalesce(preco_locacao_estimado, 0), 0)
          into v_descricao, v_preco_base
        from public.itens_conceituais
        where id = v_item.item_conceitual_id
          and empresa_id = p_empresa_id;
        v_possui_conceitual := true;
      else
        if v_item.kit_id is not null
          or v_item.estoque_item_id is not null
          or v_item.item_conceitual_id is not null
          or length(trim(coalesce(v_item.descricao, ''))) = 0 then
          raise exception using message = 'Item livre inválido.', errcode = '22023';
        end if;
        v_descricao := trim(v_item.descricao);
        v_preco_base := greatest(coalesce(v_item.preco_base, 0), 0);
    end case;

    if v_descricao is null or v_preco_base is null then
      raise exception using
        message = 'Item referenciado não foi encontrado.',
        errcode = 'P0002';
    end if;

    v_preco_negociado := coalesce(v_item.preco_unitario_orcamento, v_preco_base);
    if v_preco_negociado < 0
      or v_desconto_item < 0
      or v_desconto_item > v_quantidade * v_preco_negociado
    then
      raise exception using
        message = 'Preço ou desconto do item inválido.',
        errcode = '22023';
    end if;

    insert into public.orcamento_itens (
      orcamento_id,
      kit_id,
      estoque_item_id,
      item_conceitual_id,
      tipo_origem,
      descricao,
      quantidade,
      valor_unitario,
      preco_base,
      preco_unitario_orcamento,
      desconto,
      observacao,
      ordem
    ) values (
      v_orcamento.id,
      v_item.kit_id,
      v_item.estoque_item_id,
      v_item.item_conceitual_id,
      upper(v_item.tipo_origem),
      v_descricao,
      v_quantidade,
      v_preco_negociado,
      v_preco_base,
      v_preco_negociado,
      v_desconto_item,
      nullif(trim(v_item.observacao), ''),
      coalesce(v_item.ordem, 0)
    );
  end loop;

  for v_taxa in
    select *
    from jsonb_to_recordset(coalesce(p_taxas, '[]'::jsonb)) as taxa(
      descricao text,
      valor numeric,
      tipo text,
      observacao text,
      ordem integer
    )
  loop
    if length(trim(coalesce(v_taxa.descricao, ''))) = 0
      or coalesce(v_taxa.valor, -1) < 0
      or upper(coalesce(v_taxa.tipo, 'OUTRA')) not in (
        'ENTREGA', 'RETIRADA', 'MONTAGEM', 'DESMONTAGEM',
        'TRANSPORTE', 'DESLOCAMENTO', 'EXTRA', 'OUTRA'
      )
    then
      raise exception using
        message = 'Taxa do orçamento inválida.',
        errcode = '22023';
    end if;

    insert into public.orcamento_taxas (
      empresa_id,
      orcamento_id,
      descricao,
      valor,
      tipo,
      observacao,
      ordem,
      created_by
    ) values (
      p_empresa_id,
      v_orcamento.id,
      trim(v_taxa.descricao),
      v_taxa.valor,
      upper(coalesce(v_taxa.tipo, 'OUTRA')),
      nullif(trim(v_taxa.observacao), ''),
      coalesce(v_taxa.ordem, 0),
      p_usuario_id
    );
  end loop;

  select *
    into v_orcamento
  from public.orcamentos
  where id = v_orcamento.id;

  return jsonb_build_object(
    'id', v_orcamento.id,
    'numero', v_orcamento.numero,
    'status_anterior', v_status_anterior,
    'status', v_orcamento.status,
    'versao', v_orcamento.versao,
    'subtotal', v_orcamento.subtotal,
    'desconto', v_orcamento.desconto,
    'total_taxas', v_orcamento.total_taxas,
    'total', v_orcamento.total,
    'criado', v_criado,
    'alterado', true,
    'possui_item_conceitual', v_possui_conceitual
  );
end;
$$;

revoke all on function public.salvar_orcamento_jornada3_servidor(
  uuid, uuid, uuid, integer, text, text, text, uuid, text, text, text, text,
  date, text, date, time without time zone, date, text, text, text, numeric,
  jsonb, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.salvar_orcamento_jornada3_servidor(
  uuid, uuid, uuid, integer, text, text, text, uuid, text, text, text, text,
  date, text, date, time without time zone, date, text, text, text, numeric,
  jsonb, jsonb
) to service_role;
