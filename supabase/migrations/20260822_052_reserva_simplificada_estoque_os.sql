-- Jornada simplificada da reserva:
-- 1. estoque somente é comprometido por reservas Confirmadas/Em andamento;
-- 2. orçamento/reserva preservam itens escolhidos diretamente do estoque;
-- 3. horário de retirada acompanha orçamento, reserva e Ordem de Serviço;
-- 4. OS mantém snapshot do nome do cliente para retirada/operação.

alter table public.orcamentos
  add column if not exists horario_retirada time without time zone;

alter table public.reservas
  add column if not exists horario_retirada time without time zone;

alter table public.ordens_servico
  add column if not exists cliente_nome text,
  add column if not exists data_retirada date,
  add column if not exists horario_retirada time without time zone;

alter table public.orcamento_itens
  add column if not exists estoque_item_id uuid;

alter table public.reserva_itens
  add column if not exists estoque_item_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orcamento_itens_estoque_item_id_fkey'
  ) then
    alter table public.orcamento_itens
      add constraint orcamento_itens_estoque_item_id_fkey
      foreign key (estoque_item_id) references public.estoque_itens(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'reserva_itens_estoque_item_id_fkey'
  ) then
    alter table public.reserva_itens
      add constraint reserva_itens_estoque_item_id_fkey
      foreign key (estoque_item_id) references public.estoque_itens(id) on delete restrict;
  end if;
end;
$$;

create index if not exists idx_orcamento_itens_estoque_item
  on public.orcamento_itens(estoque_item_id)
  where estoque_item_id is not null;

create index if not exists idx_reserva_itens_estoque_item
  on public.reserva_itens(estoque_item_id)
  where estoque_item_id is not null;

-- Nenhuma proposta aceita mantém bloqueio/hold de estoque.
update public.orcamentos
set hold_expira_em = null
where hold_expira_em is not null;

create or replace function public.gerenciar_hold_orcamento_v2()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  -- Compatibilidade: a coluna permanece, mas não representa mais bloqueio.
  new.hold_expira_em := null;
  if new.status in ('RECUSADA', 'EXPIRADA', 'CANCELADA') then
    new.formalizacao_bloqueio := null;
  end if;
  return new;
end;
$$;

-- Quantidade já comprometida de um item físico por reservas efetivamente confirmadas.
create or replace function public.quantidade_estoque_comprometida(
  p_estoque_item_id uuid,
  p_inicio date,
  p_fim date,
  p_reserva_ignorar uuid default null
)
returns numeric
language sql
security definer
set search_path = 'public'
as $$
  with reservas_periodo as (
    select r.id, r.kit_id
    from public.reservas r
    where r.status in ('Confirmada', 'Em andamento')
      and (p_reserva_ignorar is null or r.id <> p_reserva_ignorar)
      and coalesce(r.data_retirada, r.data_evento, r.data_festa) is not null
      and coalesce(r.data_devolucao, r.data_evento, r.data_festa) is not null
      and daterange(
        coalesce(r.data_retirada, r.data_evento, r.data_festa),
        coalesce(r.data_devolucao, r.data_evento, r.data_festa),
        '[]'
      ) && daterange(p_inicio, p_fim, '[]')
  ),
  direto as (
    select coalesce(sum(ri.quantidade), 0)::numeric as quantidade
    from reservas_periodo rp
    join public.reserva_itens ri on ri.reserva_id = rp.id
    where ri.estoque_item_id = p_estoque_item_id
  ),
  via_kits as (
    select coalesce(sum(kc.quantidade * greatest(coalesce(ri.quantidade, 1), 1)), 0)::numeric as quantidade
    from reservas_periodo rp
    join public.reserva_itens ri
      on ri.reserva_id = rp.id
     and ri.kit_id is not null
    join public.kit_composicao kc
      on kc.kit_id = ri.kit_id
     and kc.item_id = p_estoque_item_id
  ),
  legado as (
    select coalesce(sum(kc.quantidade), 0)::numeric as quantidade
    from reservas_periodo rp
    join public.kit_composicao kc
      on kc.kit_id = rp.kit_id
     and kc.item_id = p_estoque_item_id
    where rp.kit_id is not null
      and not exists (
        select 1
        from public.reserva_itens ri
        where ri.reserva_id = rp.id
          and ri.kit_id is not null
      )
  )
  select (select quantidade from direto)
       + (select quantidade from via_kits)
       + (select quantidade from legado);
$$;

revoke all on function public.quantidade_estoque_comprometida(uuid,date,date,uuid)
  from public, anon, authenticated, service_role;

create or replace function public.verificar_disponibilidade_estoque_item(
  p_estoque_item_id uuid,
  p_quantidade numeric,
  p_inicio date,
  p_fim date,
  p_reserva_ignorar uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_item public.estoque_itens%rowtype;
  v_comprometido numeric := 0;
begin
  if p_inicio is null or p_fim is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Informe o período da reserva.');
  end if;
  if p_fim < p_inicio then
    return jsonb_build_object('disponivel', false, 'motivo', 'A data final não pode ser anterior à data inicial.');
  end if;
  if coalesce(p_quantidade, 0) <= 0 then
    return jsonb_build_object('disponivel', false, 'motivo', 'Informe uma quantidade válida.');
  end if;

  select * into v_item
  from public.estoque_itens
  where id = p_estoque_item_id;

  if not found or coalesce(v_item.status, 'Disponível') = 'Inativo' then
    return jsonb_build_object('disponivel', false, 'motivo', 'Item de estoque não encontrado ou inativo.');
  end if;

  v_comprometido := public.quantidade_estoque_comprometida(
    p_estoque_item_id, p_inicio, p_fim, p_reserva_ignorar
  );

  if v_comprometido + p_quantidade > coalesce(v_item.quantidade_disponivel, 0) then
    return jsonb_build_object(
      'disponivel', false,
      'motivo', 'Estoque insuficiente no período para o item ' || coalesce(v_item.codigo || ' - ', '') || v_item.nome || '.',
      'disponivel_quantidade', greatest(coalesce(v_item.quantidade_disponivel, 0) - v_comprometido, 0)
    );
  end if;

  return jsonb_build_object(
    'disponivel', true,
    'motivo', 'Item disponível no período. O estoque será bloqueado somente na confirmação da reserva.',
    'disponivel_quantidade', greatest(coalesce(v_item.quantidade_disponivel, 0) - v_comprometido, 0)
  );
end;
$$;

revoke all on function public.verificar_disponibilidade_estoque_item(uuid,numeric,date,date,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.verificar_disponibilidade_estoque_item(uuid,numeric,date,date,uuid)
  to authenticated, service_role;

-- Mantém o nome legado da função para não quebrar telas, porém sem considerar holds.
create or replace function public.verificar_disponibilidade_kit_com_hold(
  p_kit_id uuid,
  p_inicio date,
  p_fim date,
  p_reserva_ignorar uuid,
  p_orcamento_ignorar uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_capacidade integer;
  v_reservas_kit integer := 0;
  v_componente record;
  v_resultado jsonb;
begin
  if p_inicio is null or p_fim is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Informe o período da reserva.');
  end if;
  if p_fim < p_inicio then
    return jsonb_build_object('disponivel', false, 'motivo', 'A data final não pode ser anterior à data inicial.');
  end if;

  select greatest(coalesce(quantidade, 1), 1)
  into v_capacidade
  from public.kits
  where id = p_kit_id
    and coalesce(status, 'Disponível') <> 'Inativo';

  if v_capacidade is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Kit não encontrado ou inativo.');
  end if;

  select count(*)::integer
  into v_reservas_kit
  from public.reservas reserva
  where reserva.status in ('Confirmada', 'Em andamento')
    and (p_reserva_ignorar is null or reserva.id <> p_reserva_ignorar)
    and coalesce(reserva.data_retirada, reserva.data_evento, reserva.data_festa) is not null
    and coalesce(reserva.data_devolucao, reserva.data_evento, reserva.data_festa) is not null
    and daterange(
      coalesce(reserva.data_retirada, reserva.data_evento, reserva.data_festa),
      coalesce(reserva.data_devolucao, reserva.data_evento, reserva.data_festa),
      '[]'
    ) && daterange(p_inicio, p_fim, '[]')
    and (
      exists (
        select 1 from public.reserva_itens item
        where item.reserva_id = reserva.id and item.kit_id = p_kit_id
      )
      or (
        not exists (
          select 1 from public.reserva_itens item
          where item.reserva_id = reserva.id and item.kit_id is not null
        )
        and reserva.kit_id = p_kit_id
      )
    );

  if v_reservas_kit >= v_capacidade then
    return jsonb_build_object(
      'disponivel', false,
      'motivo', 'Todas as unidades deste kit já estão confirmadas no período.'
    );
  end if;

  for v_componente in
    select item_id, coalesce(quantidade, 1) as quantidade
    from public.kit_composicao
    where kit_id = p_kit_id
      and item_id is not null
  loop
    v_resultado := public.verificar_disponibilidade_estoque_item(
      v_componente.item_id,
      v_componente.quantidade,
      p_inicio,
      p_fim,
      p_reserva_ignorar
    );
    if not coalesce((v_resultado->>'disponivel')::boolean, false) then
      return v_resultado;
    end if;
  end loop;

  return jsonb_build_object(
    'disponivel', true,
    'motivo', 'Kit disponível no período. O estoque será bloqueado somente na confirmação da reserva.'
  );
end;
$$;

-- Valida toda a seleção do orçamento, somando kits e itens avulsos que compartilham o mesmo estoque.
create or replace function public.verificar_disponibilidade_orcamento_confirmacao(
  p_orcamento_id uuid,
  p_reserva_ignorar uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_linha record;
  v_capacidade integer;
  v_confirmadas integer;
  v_disponivel numeric;
  v_comprometido numeric;
  v_item_nome text;
begin
  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id;

  if not found then
    return jsonb_build_object('disponivel', false, 'motivo', 'Proposta não encontrada.');
  end if;

  if coalesce(v_orcamento.data_retirada, v_orcamento.data_evento) is null
     or coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento) is null then
    return jsonb_build_object('disponivel', false, 'motivo', 'Informe o período da reserva.');
  end if;

  -- Capacidade comercial de cada KIT pronto.
  for v_linha in
    select oi.kit_id, sum(greatest(coalesce(oi.quantidade, 1), 1))::integer as quantidade
    from public.orcamento_itens oi
    where oi.orcamento_id = p_orcamento_id
      and oi.kit_id is not null
    group by oi.kit_id
  loop
    select greatest(coalesce(k.quantidade, 1), 1)
    into v_capacidade
    from public.kits k
    where k.id = v_linha.kit_id
      and coalesce(k.status, 'Disponível') <> 'Inativo';

    if v_capacidade is null then
      return jsonb_build_object('disponivel', false, 'motivo', 'Um dos kits não existe ou está inativo.');
    end if;

    select count(*)::integer
    into v_confirmadas
    from public.reservas r
    where r.status in ('Confirmada', 'Em andamento')
      and (p_reserva_ignorar is null or r.id <> p_reserva_ignorar)
      and daterange(
        coalesce(r.data_retirada, r.data_evento, r.data_festa),
        coalesce(r.data_devolucao, r.data_evento, r.data_festa),
        '[]'
      ) && daterange(
        coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
        coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
        '[]'
      )
      and (
        exists (
          select 1 from public.reserva_itens ri
          where ri.reserva_id = r.id and ri.kit_id = v_linha.kit_id
        )
        or (
          not exists (
            select 1 from public.reserva_itens ri
            where ri.reserva_id = r.id and ri.kit_id is not null
          )
          and r.kit_id = v_linha.kit_id
        )
      );

    if v_confirmadas + v_linha.quantidade > v_capacidade then
      return jsonb_build_object('disponivel', false, 'motivo', 'O kit selecionado não possui disponibilidade para confirmação neste período.');
    end if;
  end loop;

  -- Consumo físico agregado: itens diretos + componentes dos kits.
  for v_linha in
    with solicitados as (
      select oi.estoque_item_id as item_id, sum(oi.quantidade)::numeric as quantidade
      from public.orcamento_itens oi
      where oi.orcamento_id = p_orcamento_id
        and oi.estoque_item_id is not null
      group by oi.estoque_item_id
      union all
      select kc.item_id, sum(kc.quantidade * greatest(coalesce(oi.quantidade, 1), 1))::numeric
      from public.orcamento_itens oi
      join public.kit_composicao kc on kc.kit_id = oi.kit_id
      where oi.orcamento_id = p_orcamento_id
        and oi.kit_id is not null
        and kc.item_id is not null
      group by kc.item_id
    )
    select item_id, sum(quantidade)::numeric as quantidade
    from solicitados
    group by item_id
    order by item_id
  loop
    select coalesce(e.quantidade_disponivel, 0), coalesce(e.codigo || ' - ', '') || e.nome
    into v_disponivel, v_item_nome
    from public.estoque_itens e
    where e.id = v_linha.item_id
      and coalesce(e.status, 'Disponível') <> 'Inativo';

    if not found then
      return jsonb_build_object('disponivel', false, 'motivo', 'Um item do estoque não existe ou está inativo.');
    end if;

    v_comprometido := public.quantidade_estoque_comprometida(
      v_linha.item_id,
      coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
      coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
      p_reserva_ignorar
    );

    if v_comprometido + v_linha.quantidade > v_disponivel then
      return jsonb_build_object(
        'disponivel', false,
        'motivo', 'Estoque insuficiente para confirmar: ' || v_item_nome || '.',
        'item_id', v_linha.item_id
      );
    end if;
  end loop;

  return jsonb_build_object(
    'disponivel', true,
    'motivo', 'Seleção disponível. O bloqueio será efetivado na confirmação da reserva.'
  );
end;
$$;

revoke all on function public.verificar_disponibilidade_orcamento_confirmacao(uuid,uuid)
  from public, anon, authenticated, service_role;

-- A reserva provisória pode nascer sem kit pronto: um KIT personalizado pode ser só itens do estoque.
create or replace function public.formalizar_orcamento_aprovado(
  p_orcamento_id uuid,
  p_valor_sinal numeric,
  p_vencimento date
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_reserva_id uuid;
  v_contrato_id uuid;
  v_lancamento_id uuid;
  v_numero_contrato text;
  v_kit_id uuid;
  v_total_fisicos integer;
  v_linha record;
  v_ordem integer := 0;
  v_disponibilidade jsonb;
  v_status_formalizacao text;
begin
  if auth.uid() is null then raise exception 'Sua sessão expirou. Entre novamente no ERP.'; end if;

  select * into v_orcamento from public.orcamentos where id=p_orcamento_id for update;
  if not found then raise exception 'Orçamento não encontrado.'; end if;
  if v_orcamento.status not in ('ACEITA','Aprovado') then raise exception 'O cliente precisa aceitar a proposta antes da formalização.'; end if;
  if v_orcamento.status='ACEITA' and (v_orcamento.dados_cliente_completos_em is null or v_orcamento.cliente_id is null) then
    raise exception 'Complete os dados do cliente antes de gerar o contrato.';
  end if;
  if v_orcamento.cliente_id is null then raise exception 'Não foi possível identificar o cliente desta proposta.'; end if;
  if v_orcamento.data_evento is null then raise exception 'Informe a data do evento antes de formalizar a proposta.'; end if;
  if coalesce(p_valor_sinal,0)<=0 then raise exception 'Informe um valor de sinal maior que zero.'; end if;
  if p_valor_sinal>v_orcamento.total then raise exception 'O sinal não pode ser maior que o total da proposta.'; end if;
  if p_vencimento is null then raise exception 'Informe a data de vencimento do sinal.'; end if;

  select count(*)::integer into v_total_fisicos
  from public.orcamento_itens item
  where item.orcamento_id=p_orcamento_id
    and (item.kit_id is not null or item.estoque_item_id is not null);

  if v_total_fisicos=0 then
    raise exception 'Adicione um KIT pronto ou itens do estoque para montar o KIT personalizado.';
  end if;

  if exists (
    select 1 from public.orcamento_itens item
    where item.orcamento_id=p_orcamento_id
      and item.kit_id is not null
      and item.quantidade<>1
  ) then
    raise exception 'Cada KIT pronto deve ser incluído em uma linha individual da reserva.';
  end if;

  if exists (
    select 1 from public.orcamento_itens item
    where item.orcamento_id=p_orcamento_id
      and item.kit_id is not null
    group by item.kit_id having count(*)>1
  ) then
    raise exception 'O mesmo KIT pronto não pode aparecer em mais de uma linha da proposta.';
  end if;

  v_disponibilidade := public.verificar_disponibilidade_orcamento_confirmacao(p_orcamento_id, v_orcamento.reserva_id);
  if not coalesce((v_disponibilidade->>'disponivel')::boolean,false) then
    raise exception '%', coalesce(v_disponibilidade->>'motivo','A seleção não está disponível no período.');
  end if;

  v_reserva_id:=v_orcamento.reserva_id;
  if v_reserva_id is null then
    select reserva.id into v_reserva_id
    from public.reservas reserva
    where reserva.orcamento_id=p_orcamento_id
    order by reserva.created_at limit 1;
  end if;

  select item.kit_id into v_kit_id
  from public.orcamento_itens item
  where item.orcamento_id=p_orcamento_id and item.kit_id is not null
  order by item.created_at limit 1;

  if v_reserva_id is null then
    insert into public.reservas (
      cliente_id,kit_id,data_evento,horario_evento,endereco_evento,valor_total,valor_sinal,status,observacoes,
      data_retirada,horario_retirada,data_devolucao,status_comercial,status_operacional,status_pagamento,orcamento_id
    ) values (
      v_orcamento.cliente_id,v_kit_id,v_orcamento.data_evento,v_orcamento.horario_evento,v_orcamento.endereco_evento,v_orcamento.total,p_valor_sinal,'Pendente',
      concat_ws(E'\n\n','Reserva provisória gerada pela proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.','O estoque será bloqueado somente após assinatura do contrato e pagamento do sinal.',nullif(v_orcamento.observacoes,'')),
      coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),v_orcamento.horario_retirada,coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
      'Aguardando formalização','Aguardando confirmação','Pendente',p_orcamento_id
    ) returning id into v_reserva_id;

    for v_linha in
      select * from public.orcamento_itens item
      where item.orcamento_id=p_orcamento_id
      order by item.created_at
    loop
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (
        reserva_id,kit_id,estoque_item_id,descricao,quantidade,valor_unitario,ordem
      ) values (
        v_reserva_id,
        v_linha.kit_id,
        v_linha.estoque_item_id,
        v_linha.descricao,
        case when v_linha.kit_id is not null then 1 else v_linha.quantidade end,
        case when v_linha.kit_id is not null then v_linha.subtotal else v_linha.valor_unitario end,
        v_ordem
      );
    end loop;

    if coalesce(v_orcamento.desconto,0)>0 then
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem)
      values (v_reserva_id,'Desconto comercial',1,-v_orcamento.desconto,v_ordem);
    end if;
    if coalesce(v_orcamento.acrescimos,0)>0 then
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem)
      values (v_reserva_id,'Acréscimos',1,v_orcamento.acrescimos,v_ordem);
    end if;
    if coalesce(v_orcamento.frete,0)>0 then
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (reserva_id,descricao,quantidade,valor_unitario,ordem)
      values (v_reserva_id,'Frete',1,v_orcamento.frete,v_ordem);
    end if;
  else
    update public.reservas
    set cliente_id=v_orcamento.cliente_id,
        valor_sinal=p_valor_sinal,
        data_retirada=coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),
        horario_retirada=v_orcamento.horario_retirada,
        data_devolucao=coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
        status_pagamento=case when status_pagamento in ('Pago','Quitado','Sinal pago') then status_pagamento else 'Pendente' end
    where id=v_reserva_id;
  end if;

  v_contrato_id:=v_orcamento.contrato_id;
  if v_contrato_id is null then
    select contrato.id into v_contrato_id
    from public.contratos contrato
    where contrato.reserva_id=v_reserva_id
    order by contrato.created_at limit 1;
  end if;
  if v_contrato_id is null then
    v_numero_contrato:='CTR-'||extract(year from (now() at time zone 'America/Sao_Paulo'))::integer::text||'-'||lpad(v_orcamento.numero::text,4,'0');
    insert into public.contratos (reserva_id,numero_contrato,status,observacoes)
    values (v_reserva_id,v_numero_contrato,'Gerado','Contrato gerado automaticamente na formalização da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.')
    returning id into v_contrato_id;
    insert into public.contrato_versoes (contrato_id,versao,conteudo,status)
    values (v_contrato_id,1,'Contrato gerado automaticamente a partir da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.','Rascunho');
  end if;

  v_lancamento_id:=v_orcamento.lancamento_sinal_id;
  if v_lancamento_id is null then
    select lancamento.id into v_lancamento_id
    from public.lancamentos_financeiros lancamento
    where lancamento.reserva_id=v_reserva_id and lancamento.categoria='Sinal' and lancamento.status<>'Cancelado'
    order by lancamento.created_at limit 1;
  end if;
  if v_lancamento_id is null then
    insert into public.lancamentos_financeiros (reserva_id,tipo,descricao,categoria,valor,data_vencimento,status,observacoes)
    values (v_reserva_id,'Receita','Sinal da proposta ORC-'||lpad(v_orcamento.numero::text,4,'0'),'Sinal',p_valor_sinal,p_vencimento,'Pendente','Cobrança criada na formalização comercial V2.')
    returning id into v_lancamento_id;
  else
    update public.lancamentos_financeiros
    set valor=p_valor_sinal,data_vencimento=p_vencimento
    where id=v_lancamento_id and status='Pendente';
  end if;

  select case
    when contrato.status='Assinado' then case when lancamento.status='Pago' then 'PRONTA_PARA_CONFIRMAR' else 'AGUARDANDO_PAGAMENTO' end
    when contrato.email_enviado_em is not null or contrato.status='Enviado' then 'AGUARDANDO_ASSINATURA'
    else 'CONTRATO_GERADO'
  end into v_status_formalizacao
  from public.contratos contrato
  left join public.lancamentos_financeiros lancamento on lancamento.id=v_lancamento_id
  where contrato.id=v_contrato_id;

  update public.orcamentos
  set reserva_id=v_reserva_id,
      contrato_id=v_contrato_id,
      lancamento_sinal_id=v_lancamento_id,
      valor_sinal_formalizacao=p_valor_sinal,
      vencimento_sinal=p_vencimento,
      formalizacao_status=coalesce(v_status_formalizacao,'CONTRATO_GERADO'),
      formalizacao_bloqueio=null,
      hold_expira_em=null
  where id=p_orcamento_id;

  return jsonb_build_object(
    'reserva_id',v_reserva_id,
    'contrato_id',v_contrato_id,
    'lancamento_sinal_id',v_lancamento_id,
    'status',coalesce(v_status_formalizacao,'CONTRATO_GERADO'),
    'mensagem','Reserva provisória, contrato e cobrança preparados. O estoque será bloqueado somente na confirmação definitiva.'
  );
end;
$$;

-- Finalizador: serializa os itens físicos envolvidos, revalida e só então confirma.
create or replace function public.tentar_confirmar_reserva_formalizada(p_orcamento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_reserva public.reservas%rowtype;
  v_contrato_assinado boolean := false;
  v_sinal_pago boolean := false;
  v_disponibilidade jsonb;
  v_motivo text;
  v_status text;
begin
  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Proposta não encontrada.';
  end if;

  if v_orcamento.reserva_id is null then
    return jsonb_build_object('confirmada',false,'nova_confirmacao',false,'status',v_orcamento.formalizacao_status,'motivo','Reserva provisória ainda não foi criada.');
  end if;

  select * into v_reserva
  from public.reservas
  where id = v_orcamento.reserva_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Reserva provisória não encontrada.';
  end if;

  select coalesce(contrato.status = 'Assinado', false)
  into v_contrato_assinado
  from public.contratos contrato
  where contrato.id = v_orcamento.contrato_id;

  select coalesce(lancamento.status = 'Pago', false)
  into v_sinal_pago
  from public.lancamentos_financeiros lancamento
  where lancamento.id = v_orcamento.lancamento_sinal_id;

  v_contrato_assinado := coalesce(v_contrato_assinado, false);
  v_sinal_pago := coalesce(v_sinal_pago, false);

  if not v_contrato_assinado or not v_sinal_pago then
    v_status := case when not v_contrato_assinado then 'AGUARDANDO_ASSINATURA' else 'AGUARDANDO_PAGAMENTO' end;
    update public.orcamentos
    set formalizacao_status=v_status,formalizacao_bloqueio=null,hold_expira_em=null
    where id=v_orcamento.id and formalizacao_status is distinct from 'RESERVA_CONFIRMADA';
    return jsonb_build_object('confirmada',false,'nova_confirmacao',false,'status',v_status,'contrato_assinado',v_contrato_assinado,'sinal_pago',v_sinal_pago);
  end if;

  if v_reserva.status = 'Confirmada' then
    update public.orcamentos
    set formalizacao_status='RESERVA_CONFIRMADA',formalizacao_bloqueio=null,hold_expira_em=null,formalizado_em=coalesce(formalizado_em,now())
    where id=v_orcamento.id;
    return jsonb_build_object('confirmada',true,'nova_confirmacao',false,'status','RESERVA_CONFIRMADA','reserva_id',v_reserva.id,'contrato_assinado',true,'sinal_pago',true);
  end if;

  -- Serializa confirmações concorrentes que disputem os mesmos kits/itens físicos.
  perform k.id
  from public.kits k
  where k.id in (
    select distinct oi.kit_id
    from public.orcamento_itens oi
    where oi.orcamento_id=v_orcamento.id and oi.kit_id is not null
  )
  order by k.id
  for update;

  perform e.id
  from public.estoque_itens e
  where e.id in (
    select oi.estoque_item_id
    from public.orcamento_itens oi
    where oi.orcamento_id=v_orcamento.id and oi.estoque_item_id is not null
    union
    select kc.item_id
    from public.orcamento_itens oi
    join public.kit_composicao kc on kc.kit_id=oi.kit_id
    where oi.orcamento_id=v_orcamento.id and oi.kit_id is not null and kc.item_id is not null
  )
  order by e.id
  for update;

  update public.orcamentos
  set formalizacao_status='PRONTA_PARA_CONFIRMAR',formalizacao_bloqueio=null,hold_expira_em=null
  where id=v_orcamento.id;

  v_disponibilidade := public.verificar_disponibilidade_orcamento_confirmacao(v_orcamento.id,v_reserva.id);
  if not coalesce((v_disponibilidade->>'disponivel')::boolean,false) then
    v_motivo:=coalesce(v_disponibilidade->>'motivo','A disponibilidade precisa ser revisada antes da confirmação.');
    update public.orcamentos set formalizacao_bloqueio=v_motivo where id=v_orcamento.id;
    return jsonb_build_object('confirmada',false,'nova_confirmacao',false,'status','PRONTA_PARA_CONFIRMAR','bloqueada',true,'motivo',v_motivo,'contrato_assinado',true,'sinal_pago',true);
  end if;

  update public.reservas
  set status='Confirmada',status_comercial='Confirmada',status_operacional='Aguardando operação'
  where id=v_reserva.id and status is distinct from 'Confirmada';

  update public.orcamentos
  set formalizacao_status='RESERVA_CONFIRMADA',formalizacao_bloqueio=null,hold_expira_em=null,formalizado_em=coalesce(formalizado_em,now())
  where id=v_orcamento.id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades set etapa='Fechado',motivo_perda=null
    where id=v_orcamento.oportunidade_id and etapa<>'Perdido';
  end if;

  return jsonb_build_object('confirmada',true,'nova_confirmacao',true,'status','RESERVA_CONFIRMADA','reserva_id',v_reserva.id,'contrato_assinado',true,'sinal_pago',true);
end;
$$;

-- O trigger de disponibilidade passa a validar o orçamento completo na transição para Confirmada.
create or replace function public.validar_disponibilidade_reserva()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  v_resultado jsonb;
begin
  if new.status not in ('Confirmada', 'Em andamento') then
    return new;
  end if;

  if new.orcamento_id is not null then
    v_resultado := public.verificar_disponibilidade_orcamento_confirmacao(new.orcamento_id,new.id);
  elsif new.kit_id is not null then
    v_resultado := public.verificar_disponibilidade_kit_com_hold(
      new.kit_id,
      coalesce(new.data_retirada,new.data_evento,new.data_festa),
      coalesce(new.data_devolucao,new.data_evento,new.data_festa),
      new.id,
      null
    );
  else
    return new;
  end if;

  if not coalesce((v_resultado->>'disponivel')::boolean,false) then
    raise exception '%',v_resultado->>'motivo' using errcode='23514';
  end if;
  return new;
end;
$$;

-- Itens adicionados a uma reserva já confirmada também respeitam o estoque.
create or replace function public.validar_item_reserva()
returns trigger
language plpgsql
set search_path = 'public'
as $$
declare
  v_reserva public.reservas%rowtype;
  v_resultado jsonb;
begin
  select * into v_reserva from public.reservas where id=new.reserva_id;
  if not found or v_reserva.status not in ('Confirmada','Em andamento') then return new; end if;

  if new.kit_id is not null then
    v_resultado:=public.verificar_disponibilidade_kit_com_hold(
      new.kit_id,
      coalesce(v_reserva.data_retirada,v_reserva.data_evento,v_reserva.data_festa),
      coalesce(v_reserva.data_devolucao,v_reserva.data_evento,v_reserva.data_festa),
      v_reserva.id,
      v_reserva.orcamento_id
    );
  elsif new.estoque_item_id is not null then
    v_resultado:=public.verificar_disponibilidade_estoque_item(
      new.estoque_item_id,
      new.quantidade,
      coalesce(v_reserva.data_retirada,v_reserva.data_evento,v_reserva.data_festa),
      coalesce(v_reserva.data_devolucao,v_reserva.data_evento,v_reserva.data_festa),
      v_reserva.id
    );
  else
    return new;
  end if;

  if not coalesce((v_resultado->>'disponivel')::boolean,false) then
    raise exception '%',v_resultado->>'motivo' using errcode='23514';
  end if;
  return new;
end;
$$;

-- Backfill da OS com dados já conhecidos da reserva/cliente.
update public.ordens_servico os
set cliente_nome = coalesce(os.cliente_nome, cliente.nome),
    data_retirada = coalesce(os.data_retirada, reserva.data_retirada, os.data_prevista, reserva.data_evento),
    data_prevista = coalesce(os.data_prevista, reserva.data_retirada, reserva.data_evento)
from public.reservas reserva
left join public.clientes cliente on cliente.id = reserva.cliente_id
where os.reserva_id = reserva.id;
