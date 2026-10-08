-- Teste transacional do núcleo do Orçamento 3.0.
-- Nenhum dado permanece no banco: toda a execução termina com rollback.

begin;

do $$
declare
  v_empresa_id uuid;
  v_orcamento_id uuid;
  v_item_conceitual_id uuid;
  v_item_orcamento_id uuid;
  v_estoque_antes bigint;
  v_estoque_depois bigint;
  v_subtotal numeric;
  v_desconto numeric;
  v_total_taxas numeric;
  v_total numeric;
  v_valor_unitario numeric;
  v_preco_negociado numeric;
begin
  select id into v_empresa_id
  from public.empresas
  order by created_at
  limit 1;

  if v_empresa_id is null then
    raise exception 'A homologação precisa ter uma empresa para o teste.';
  end if;

  select count(*) into v_estoque_antes from public.estoque_itens;

  insert into public.orcamentos (
    empresa_id,
    status,
    origem,
    contato_nome,
    contato_telefone,
    data_evento,
    desconto_tipo,
    desconto_valor
  ) values (
    v_empresa_id,
    'NOVO',
    'MANUAL',
    'TESTE ORÇAMENTO 3',
    '21999999999',
    current_date + 30,
    'PERCENTUAL',
    10
  )
  returning id into v_orcamento_id;

  insert into public.itens_conceituais (
    empresa_id,
    nome,
    descricao,
    preco_locacao_estimado,
    status,
    origem
  ) values (
    v_empresa_id,
    'Painel conceitual de teste',
    'Não deve criar ou aumentar estoque.',
    100,
    'PROPOSTO',
    'MANUAL'
  )
  returning id into v_item_conceitual_id;

  insert into public.orcamento_itens (
    orcamento_id,
    item_conceitual_id,
    tipo_origem,
    descricao,
    quantidade,
    preco_base,
    preco_unitario_orcamento,
    desconto
  ) values (
    v_orcamento_id,
    v_item_conceitual_id,
    'CONCEITUAL',
    'Painel conceitual de teste',
    2,
    100,
    85,
    0
  )
  returning id into v_item_orcamento_id;

  insert into public.orcamento_taxas (
    empresa_id,
    orcamento_id,
    descricao,
    valor,
    tipo
  ) values (
    v_empresa_id,
    v_orcamento_id,
    'Entrega de teste',
    30,
    'ENTREGA'
  );

  select subtotal, desconto, total_taxas, total
  into v_subtotal, v_desconto, v_total_taxas, v_total
  from public.orcamentos
  where id = v_orcamento_id;

  if v_subtotal <> 170
    or v_desconto <> 17
    or v_total_taxas <> 30
    or v_total <> 183 then
    raise exception
      'Totais inválidos: subtotal %, desconto %, taxas %, total %.',
      v_subtotal, v_desconto, v_total_taxas, v_total;
  end if;

  select valor_unitario, preco_unitario_orcamento
  into v_valor_unitario, v_preco_negociado
  from public.orcamento_itens
  where id = v_item_orcamento_id;

  if v_valor_unitario <> 85 or v_preco_negociado <> 85 then
    raise exception 'Compatibilidade de preço negociado não foi preservada.';
  end if;

  select count(*) into v_estoque_depois from public.estoque_itens;

  if v_estoque_depois <> v_estoque_antes then
    raise exception 'Item conceitual alterou o estoque automaticamente.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'itens_conceituais'
      and column_name in ('quantidade_disponivel', 'quantidade_total')
  ) then
    raise exception 'Item conceitual não pode possuir saldo de estoque.';
  end if;
end;
$$;

rollback;

select 'Orçamento 3.0 aprovado e revertido; dados temporários removidos.' as resultado;
