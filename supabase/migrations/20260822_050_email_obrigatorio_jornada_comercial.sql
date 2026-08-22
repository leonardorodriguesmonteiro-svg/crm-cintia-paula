-- Torna o e-mail obrigatório no cadastro complementar V2.
-- O e-mail será usado para comunicações comerciais e documentos da jornada.

create or replace function public.completar_dados_cliente_proposta_v2_servidor(
  p_token uuid,
  p_cpf text,
  p_cep text,
  p_endereco text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_cidade text,
  p_estado text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_oportunidade public.oportunidades%rowtype;
  v_cliente_id uuid;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
  v_cep text := regexp_replace(coalesce(p_cep, ''), '[^0-9]', '', 'g');
  v_endereco text := trim(coalesce(p_endereco, ''));
  v_numero text := trim(coalesce(p_numero, ''));
  v_complemento text := nullif(trim(coalesce(p_complemento, '')), '');
  v_bairro text := trim(coalesce(p_bairro, ''));
  v_cidade text := trim(coalesce(p_cidade, ''));
  v_estado text := upper(trim(coalesce(p_estado, '')));
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if v_cpf !~ '^[0-9]{11}$' then
    raise exception using errcode = '22023', message = 'CPF invalido.';
  end if;

  if v_cep !~ '^[0-9]{8}$' then
    raise exception using errcode = '22023', message = 'CEP invalido.';
  end if;

  if char_length(v_endereco) not between 2 and 300 then
    raise exception using errcode = '22023', message = 'Logradouro invalido.';
  end if;

  if char_length(v_numero) not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Numero do endereco invalido.';
  end if;

  if v_complemento is not null and char_length(v_complemento) > 120 then
    raise exception using errcode = '22023', message = 'Complemento muito longo.';
  end if;

  if char_length(v_bairro) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Bairro invalido.';
  end if;

  if char_length(v_cidade) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Cidade invalida.';
  end if;

  if v_estado not in (
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
    'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ) then
    raise exception using errcode = '22023', message = 'UF invalida.';
  end if;

  if v_email is null
    or char_length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception using errcode = '22023', message = 'E-mail obrigatorio e invalido.';
  end if;

  select *
  into v_orcamento
  from public.orcamentos
  where public_token = p_token
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Proposta nao encontrada.';
  end if;

  if v_orcamento.status <> 'ACEITA' then
    raise exception using errcode = '23514', message = 'A proposta precisa estar aceita.';
  end if;

  if v_orcamento.dados_cliente_completos_em is not null then
    return jsonb_build_object(
      'orcamento_id', v_orcamento.id,
      'empresa_id', v_orcamento.empresa_id,
      'oportunidade_id', v_orcamento.oportunidade_id,
      'numero', v_orcamento.numero,
      'status', v_orcamento.formalizacao_status,
      'ja_completo', true
    );
  end if;

  if v_orcamento.oportunidade_id is null then
    raise exception using errcode = '23514', message = 'Proposta sem pre-reserva vinculada.';
  end if;

  select *
  into v_oportunidade
  from public.oportunidades
  where id = v_orcamento.oportunidade_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Pre-reserva nao encontrada.';
  end if;

  select cliente.id
  into v_cliente_id
  from public.clientes cliente
  where regexp_replace(coalesce(cliente.cpf, ''), '[^0-9]', '', 'g') = v_cpf
  order by cliente.created_at
  limit 1;

  v_cliente_id := coalesce(
    v_cliente_id,
    v_orcamento.cliente_id,
    v_oportunidade.cliente_id
  );

  if v_cliente_id is null then
    select cliente.id
    into v_cliente_id
    from public.clientes cliente
    where regexp_replace(coalesce(cliente.whatsapp, ''), '[^0-9]', '', 'g') =
          regexp_replace(coalesce(v_oportunidade.celular, ''), '[^0-9]', '', 'g')
    order by cliente.created_at
    limit 1;
  end if;

  if v_cliente_id is null then
    insert into public.clientes (
      nome, cpf, whatsapp, email, cep, endereco, numero, complemento,
      bairro, cidade, estado, origem, status, observacoes
    ) values (
      v_oportunidade.nome_contato,
      v_cpf,
      v_oportunidade.celular,
      v_email,
      v_cep,
      v_endereco,
      v_numero,
      v_complemento,
      v_bairro,
      v_cidade,
      v_estado,
      v_oportunidade.origem,
      'Cliente',
      'Cadastro completado após o aceite da proposta.'
    )
    returning id into v_cliente_id;
  else
    update public.clientes
    set
      cpf = v_cpf,
      whatsapp = coalesce(nullif(whatsapp, ''), v_oportunidade.celular),
      email = v_email,
      cep = v_cep,
      endereco = v_endereco,
      numero = v_numero,
      complemento = v_complemento,
      bairro = v_bairro,
      cidade = v_cidade,
      estado = v_estado,
      updated_at = now()
    where id = v_cliente_id;
  end if;

  update public.oportunidades
  set cliente_id = v_cliente_id,
      email = v_email
  where id = v_oportunidade.id;

  update public.orcamentos
  set cliente_id = v_cliente_id,
      dados_cliente_completos_em = now(),
      formalizacao_status = 'DADOS_COMPLETOS'
  where id = v_orcamento.id;

  return jsonb_build_object(
    'orcamento_id', v_orcamento.id,
    'empresa_id', v_orcamento.empresa_id,
    'oportunidade_id', v_orcamento.oportunidade_id,
    'numero', v_orcamento.numero,
    'status', 'DADOS_COMPLETOS',
    'ja_completo', false
  );
end;
$$;

revoke all on function public.completar_dados_cliente_proposta_v2_servidor(
  uuid, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.completar_dados_cliente_proposta_v2_servidor(
  uuid, text, text, text, text, text, text, text, text, text
) to service_role;
