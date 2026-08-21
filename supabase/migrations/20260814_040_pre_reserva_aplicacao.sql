-- Sprint Comercial 1.1 - Etapa 2
-- Escritas atomicas e idempotentes da Application Layer da pre-reserva.
-- As funcoes sao exclusivamente servidoras e nunca devem ser chamadas do frontend.

create or replace function public.criar_pre_reserva_servidor(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_cliente_id uuid,
  p_nome_contato text,
  p_celular text,
  p_email text,
  p_origem text,
  p_origem_externa_id text,
  p_data_evento date,
  p_interesse text,
  p_itens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oportunidade public.oportunidades%rowtype;
  v_item record;
  v_nome text;
  v_valor numeric(12, 2);
  v_celular text := regexp_replace(coalesce(p_celular, ''), '[^0-9]', '', 'g');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_origem_externa_id text := nullif(trim(coalesce(p_origem_externa_id, '')), '');
  v_ordem integer := 0;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Funcao exclusiva do servidor.';
  end if;

  if not exists (
    select 1
    from public.empresas empresa
    where empresa.id = p_empresa_id
      and empresa.status = 'Ativa'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Empresa ativa nao encontrada.';
  end if;

  if p_usuario_id is not null and not exists (
    select 1
    from public.usuarios_empresa vinculo
    where vinculo.usuario_id = p_usuario_id
      and vinculo.empresa_id = p_empresa_id
      and vinculo.ativo = true
      and vinculo.perfil in ('Administrador', 'Comercial')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Usuario sem permissao comercial nesta empresa.';
  end if;

  if p_cliente_id is not null and not exists (
    select 1 from public.clientes cliente where cliente.id = p_cliente_id
  ) then
    raise exception using errcode = '22023', message = 'Cliente informado nao existe.';
  end if;

  if char_length(trim(coalesce(p_nome_contato, ''))) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Nome do contato invalido.';
  end if;

  if v_celular !~ '^[0-9]{10,11}$' then
    raise exception using errcode = '22023', message = 'Celular invalido.';
  end if;

  if v_email is not null and (
    char_length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    raise exception using errcode = '22023', message = 'E-mail invalido.';
  end if;

  if jsonb_typeof(coalesce(p_itens, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) not between 1 and 100
  then
    raise exception using
      errcode = '22023',
      message = 'A pre-reserva deve conter de 1 a 100 itens.';
  end if;

  if v_origem_externa_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_empresa_id::text || ':' || v_origem_externa_id, 0)
    );

    select *
    into v_oportunidade
    from public.oportunidades oportunidade
    where oportunidade.empresa_id = p_empresa_id
      and oportunidade.origem_externa_id = v_origem_externa_id;

    if found then
      return jsonb_build_object(
        'id', v_oportunidade.id,
        'numero', v_oportunidade.numero,
        'status', v_oportunidade.etapa,
        'criada', false
      );
    end if;
  end if;

  perform set_config(
    'app.usuario_id',
    coalesce(p_usuario_id::text, ''),
    true
  );

  insert into public.oportunidades (
    empresa_id,
    cliente_id,
    nome_contato,
    celular,
    email,
    origem,
    origem_externa_id,
    data_evento,
    interesse,
    etapa,
    responsavel_id,
    created_by
  ) values (
    p_empresa_id,
    p_cliente_id,
    trim(p_nome_contato),
    v_celular,
    v_email,
    left(coalesce(nullif(trim(p_origem), ''), 'Site'), 100),
    v_origem_externa_id,
    p_data_evento,
    nullif(left(trim(coalesce(p_interesse, '')), 1000), ''),
    'RECEBIDA',
    p_usuario_id,
    p_usuario_id
  )
  returning * into v_oportunidade;

  for v_item in
    select *
    from jsonb_to_recordset(p_itens) as item(
      tipo text,
      kit_id uuid,
      estoque_item_id uuid,
      quantidade numeric,
      observacoes text
    )
  loop
    v_ordem := v_ordem + 1;
    v_nome := null;
    v_valor := null;

    if v_item.quantidade is null or v_item.quantidade <= 0 then
      raise exception using errcode = '22023', message = 'Quantidade de item invalida.';
    end if;

    if v_item.tipo = 'KIT' and v_item.kit_id is not null
      and v_item.estoque_item_id is null
    then
      select kit.nome, greatest(coalesce(kit.valor, 0), 0)
      into v_nome, v_valor
      from public.kits kit
      where kit.id = v_item.kit_id
        and kit.status <> 'Inativo';

      if not found then
        raise exception using errcode = '22023', message = 'Kit indisponivel ou inexistente.';
      end if;
    elsif v_item.tipo = 'ITEM_ESTOQUE'
      and v_item.estoque_item_id is not null
      and v_item.kit_id is null
    then
      select item.nome
      into v_nome
      from public.estoque_itens item
      where item.id = v_item.estoque_item_id
        and item.status <> 'Inativo';

      if not found then
        raise exception using errcode = '22023', message = 'Item indisponivel ou inexistente.';
      end if;
    else
      raise exception using errcode = '22023', message = 'Referencia de item invalida.';
    end if;

    insert into public.oportunidade_itens (
      empresa_id,
      oportunidade_id,
      tipo,
      kit_id,
      estoque_item_id,
      nome_snapshot,
      valor_referencia,
      quantidade,
      observacoes,
      ordem
    ) values (
      p_empresa_id,
      v_oportunidade.id,
      v_item.tipo,
      v_item.kit_id,
      v_item.estoque_item_id,
      v_nome,
      v_valor,
      v_item.quantidade,
      nullif(left(trim(coalesce(v_item.observacoes, '')), 1000), ''),
      v_ordem
    );
  end loop;

  return jsonb_build_object(
    'id', v_oportunidade.id,
    'numero', v_oportunidade.numero,
    'status', v_oportunidade.etapa,
    'criada', true
  );
end;
$$;

create or replace function public.transicionar_pre_reserva_servidor(
  p_empresa_id uuid,
  p_oportunidade_id uuid,
  p_usuario_id uuid,
  p_versao_esperada integer,
  p_proximo_status text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oportunidade public.oportunidades%rowtype;
  v_status_anterior text;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Funcao exclusiva do servidor.';
  end if;

  if not exists (
    select 1
    from public.usuarios_empresa vinculo
    where vinculo.usuario_id = p_usuario_id
      and vinculo.empresa_id = p_empresa_id
      and vinculo.ativo = true
      and vinculo.perfil in ('Administrador', 'Comercial')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Usuario sem permissao comercial nesta empresa.';
  end if;

  if p_proximo_status not in (
    'RECEBIDA',
    'EM_ANALISE',
    'AJUSTE_SOLICITADO',
    'APROVADA',
    'RECUSADA',
    'CONVERTIDA_EM_PROPOSTA'
  ) then
    raise exception using errcode = '22023', message = 'Estado comercial invalido.';
  end if;

  select *
  into v_oportunidade
  from public.oportunidades oportunidade
  where oportunidade.id = p_oportunidade_id
    and oportunidade.empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Pre-reserva nao encontrada.';
  end if;

  if v_oportunidade.versao <> p_versao_esperada then
    raise exception using
      errcode = '40001',
      message = 'A pre-reserva foi alterada por outro usuario. Atualize a tela.';
  end if;

  v_status_anterior := v_oportunidade.etapa;

  perform set_config('app.usuario_id', p_usuario_id::text, true);

  update public.oportunidades
  set
    etapa = p_proximo_status,
    versao = versao + 1
  where id = p_oportunidade_id
    and empresa_id = p_empresa_id
  returning * into v_oportunidade;

  if nullif(trim(coalesce(p_observacao, '')), '') is not null then
    insert into public.oportunidade_historico (
      oportunidade_id,
      usuario_id,
      tipo,
      descricao,
      etapa_anterior,
      etapa_nova
    ) values (
      p_oportunidade_id,
      p_usuario_id,
      'Observação',
      left(trim(p_observacao), 2000),
      v_status_anterior,
      p_proximo_status
    );
  end if;

  return jsonb_build_object(
    'id', v_oportunidade.id,
    'numero', v_oportunidade.numero,
    'status_anterior', v_status_anterior,
    'status', v_oportunidade.etapa,
    'versao', v_oportunidade.versao
  );
end;
$$;

-- Permite que triggers de historico identifiquem o autor quando a escrita usa
-- a chave de servidor. Chamadas autenticadas continuam usando auth.uid().
create or replace function public.registrar_historico_oportunidade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := coalesce(
    (select auth.uid()),
    nullif(current_setting('app.usuario_id', true), '')::uuid,
    new.created_by
  );
begin
  if tg_op = 'INSERT' then
    insert into public.oportunidade_historico (
      oportunidade_id,
      usuario_id,
      tipo,
      descricao,
      etapa_nova
    ) values (
      new.id,
      v_usuario_id,
      'Criação',
      'Pré-reserva criada na jornada comercial.',
      new.etapa
    );
  elsif new.etapa is distinct from old.etapa then
    insert into public.oportunidade_historico (
      oportunidade_id,
      usuario_id,
      tipo,
      descricao,
      etapa_anterior,
      etapa_nova
    ) values (
      new.id,
      v_usuario_id,
      'Etapa',
      'Etapa alterada de “' || old.etapa || '” para “' || new.etapa || '”.',
      old.etapa,
      new.etapa
    );
  end if;

  return new;
end;
$$;

revoke all on function public.criar_pre_reserva_servidor(
  uuid, uuid, uuid, text, text, text, text, text, date, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.criar_pre_reserva_servidor(
  uuid, uuid, uuid, text, text, text, text, text, date, text, jsonb
) to service_role;

revoke all on function public.transicionar_pre_reserva_servidor(
  uuid, uuid, uuid, integer, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.transicionar_pre_reserva_servidor(
  uuid, uuid, uuid, integer, text, text
) to service_role;

revoke all on function public.registrar_historico_oportunidade()
from public, anon, authenticated, service_role;
