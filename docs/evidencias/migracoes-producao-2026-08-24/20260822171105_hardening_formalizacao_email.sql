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
set search_path = 'public'
as $$
declare
  v_perfil text;
  v_empresa_id uuid;
  v_status_orcamento text;
  v_email_cliente text;
begin
  select
    orcamento.empresa_id,
    orcamento.status,
    lower(trim(coalesce(cliente.email, '')))
  into
    v_empresa_id,
    v_status_orcamento,
    v_email_cliente
  from public.orcamentos orcamento
  left join public.clientes cliente on cliente.id = orcamento.cliente_id
  where orcamento.id = p_orcamento_id;

  if v_empresa_id is null then
    raise exception 'A proposta ainda não está vinculada a uma empresa.';
  end if;

  select vinculo.perfil
  into v_perfil
  from public.usuarios_empresa vinculo
  where vinculo.usuario_id = p_usuario_id
    and vinculo.empresa_id = v_empresa_id
    and vinculo.ativo = true
  order by case when vinculo.perfil = 'Administrador' then 0 else 1 end
  limit 1;

  if v_perfil is null then
    raise exception 'Usuário sem vínculo ativo com a empresa desta proposta.';
  end if;

  if p_acao in ('formalizar', 'confirmar_assinatura')
     and v_perfil not in ('Administrador', 'Comercial') then
    raise exception 'Seu perfil não possui permissão para formalizar esta venda.';
  end if;

  if p_acao = 'confirmar_sinal'
     and v_perfil not in ('Administrador', 'Comercial', 'Financeiro') then
    raise exception 'Seu perfil não possui permissão para confirmar o sinal.';
  end if;

  if p_acao = 'formalizar' and v_status_orcamento = 'ACEITA' then
    if v_email_cliente = ''
       or char_length(v_email_cliente) > 254
       or v_email_cliente !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Cadastre um e-mail válido do cliente antes de gerar o contrato.';
    end if;
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_usuario_id, 'role', 'authenticated')::text,
    true
  );

  if p_acao = 'formalizar' then
    return public.formalizar_orcamento_aprovado(
      p_orcamento_id,
      p_valor_sinal,
      p_vencimento
    );
  elsif p_acao = 'confirmar_assinatura' then
    return public.confirmar_assinatura_formalizacao(p_orcamento_id);
  elsif p_acao = 'confirmar_sinal' then
    return public.confirmar_pagamento_sinal_formalizacao(
      p_orcamento_id,
      p_forma_pagamento
    );
  end if;

  raise exception 'Ação de formalização inválida.';
end;
$$;

revoke all on function public.executar_formalizacao_servidor(
  uuid, uuid, text, numeric, date, text
) from public, anon, authenticated, service_role;

grant execute on function public.executar_formalizacao_servidor(
  uuid, uuid, text, numeric, date, text
) to service_role;
