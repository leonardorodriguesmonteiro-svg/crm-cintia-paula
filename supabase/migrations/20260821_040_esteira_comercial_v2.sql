-- Sprint Comercial 1.1 — Esteira Comercial V2
-- Objetivos:
-- 1) separar pré-reserva, proposta, contratação e reserva confirmada;
-- 2) impedir que uma proposta aprovada vire reserva confirmada antes de contrato + sinal;
-- 3) coletar dados contratuais somente após o aceite da proposta;
-- 4) integrar a pré-reserva do site ao funil comercial;
-- 5) descontinuar CPF e caução na pré-reserva, preservando colunas históricas.

begin;

-- -----------------------------------------------------------------------------
-- 1. Jornada comercial canônica (mantém etapa legada por compatibilidade)
-- -----------------------------------------------------------------------------

alter table public.oportunidades
add column if not exists jornada_status text not null default 'Pré-reserva';

alter table public.oportunidades
drop constraint if exists oportunidades_jornada_status_check;

alter table public.oportunidades
add constraint oportunidades_jornada_status_check
check (
  jornada_status in (
    'Pré-reserva',
    'Em análise',
    'Ajuste solicitado',
    'Proposta disponível',
    'Proposta aceita',
    'Cadastro pendente',
    'Contrato pendente',
    'Assinatura pendente',
    'Pagamento pendente',
    'Reserva confirmada',
    'Em operação',
    'Concluído',
    'Perdido'
  )
);

create or replace function public.sincronizar_etapa_legada_da_jornada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.etapa := case new.jornada_status
    when 'Pré-reserva' then 'Novo contato'
    when 'Em análise' then 'Em atendimento'
    when 'Ajuste solicitado' then 'Em atendimento'
    when 'Proposta disponível' then 'Orçamento enviado'
    when 'Proposta aceita' then 'Negociação'
    when 'Cadastro pendente' then 'Negociação'
    when 'Contrato pendente' then 'Negociação'
    when 'Assinatura pendente' then 'Negociação'
    when 'Pagamento pendente' then 'Negociação'
    when 'Reserva confirmada' then 'Fechado'
    when 'Em operação' then 'Fechado'
    when 'Concluído' then 'Fechado'
    when 'Perdido' then 'Perdido'
    else new.etapa
  end;

  return new;
end;
$$;

drop trigger if exists oportunidades_sincronizar_etapa_jornada
on public.oportunidades;

create trigger oportunidades_sincronizar_etapa_jornada
before insert or update of jornada_status
on public.oportunidades
for each row
execute function public.sincronizar_etapa_legada_da_jornada();

-- Migração conservadora dos registros existentes.
update public.oportunidades oportunidade
set jornada_status = case
  when exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.oportunidade_id = oportunidade.id
      and orcamento.formalizacao_status = 'Venda confirmada'
  ) then 'Reserva confirmada'
  when exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.oportunidade_id = oportunidade.id
      and orcamento.formalizacao_status = 'Aguardando sinal'
  ) then 'Pagamento pendente'
  when exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.oportunidade_id = oportunidade.id
      and orcamento.formalizacao_status = 'Aguardando contrato'
  ) then 'Assinatura pendente'
  when exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.oportunidade_id = oportunidade.id
      and orcamento.status = 'Aprovado'
  ) then 'Cadastro pendente'
  when exists (
    select 1
    from public.orcamentos orcamento
    where orcamento.oportunidade_id = oportunidade.id
      and orcamento.status = 'Enviado'
  ) then 'Proposta disponível'
  when oportunidade.etapa = 'Perdido' then 'Perdido'
  when oportunidade.etapa = 'Fechado' then 'Reserva confirmada'
  when oportunidade.etapa = 'Negociação' then 'Proposta aceita'
  when oportunidade.etapa = 'Orçamento enviado' then 'Proposta disponível'
  when oportunidade.etapa = 'Em atendimento' then 'Em análise'
  else 'Pré-reserva'
end;

create index if not exists oportunidades_jornada_status_idx
on public.oportunidades(jornada_status, updated_at desc);

-- -----------------------------------------------------------------------------
-- 2. Orçamento: aceite, cadastro e bloqueio comercial temporário
-- -----------------------------------------------------------------------------

alter table public.orcamentos
add column if not exists cadastro_completo_em timestamptz;

alter table public.orcamentos
add column if not exists bloqueio_temporario_ate timestamptz;

create index if not exists orcamentos_bloqueio_temporario_idx
on public.orcamentos(bloqueio_temporario_ate)
where bloqueio_temporario_ate is not null;

-- -----------------------------------------------------------------------------
-- 3. Pré-reserva do site passa a gerar oportunidade no ERP
-- -----------------------------------------------------------------------------

alter table public.site_pre_reservas
add column if not exists oportunidade_id uuid references public.oportunidades(id) on delete set null;

create index if not exists site_pre_reservas_oportunidade_idx
on public.site_pre_reservas(oportunidade_id);

-- CPF e caução ficam mantidos apenas por compatibilidade/histórico.
comment on column public.site_pre_reservas.cpf is
'LEGADO: não coletar na pré-reserva. Documento deve ser solicitado somente após o aceite da proposta.';

comment on column public.site_pre_reservas.caucao is
'LEGADO: caução reembolsável descontinuada. Novas pré-reservas devem gravar zero.';

-- -----------------------------------------------------------------------------
-- 4. Resposta pública da proposta: aceite não cria reserva confirmada
-- -----------------------------------------------------------------------------

create or replace function public.registrar_resposta_publica_orcamento(
  p_token uuid,
  p_decisao text,
  p_nome text,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_agora timestamptz := now();
  v_linha record;
  v_disponibilidade jsonb;
begin
  if p_decisao not in ('Aprovado', 'Recusado') then
    raise exception 'Resposta inválida.';
  end if;

  if length(trim(coalesce(p_nome, ''))) < 2 then
    raise exception 'Informe o nome de quem está respondendo.';
  end if;

  select *
  into v_orcamento
  from public.orcamentos
  where public_token = p_token
  for update;

  if not found then
    raise exception 'Proposta não encontrada.';
  end if;

  if v_orcamento.status in ('Aprovado', 'Recusado') then
    return jsonb_build_object(
      'numero', v_orcamento.numero,
      'status', v_orcamento.status,
      'decisao', coalesce(v_orcamento.resposta_cliente, v_orcamento.status),
      'respondido_em', v_orcamento.respondido_em,
      'ja_respondido', true,
      'proximo_passo', case
        when v_orcamento.status = 'Aprovado' and v_orcamento.cadastro_completo_em is null
          then 'Completar cadastro'
        when v_orcamento.status = 'Aprovado'
          then 'Aguardar contrato'
        else null
      end
    );
  end if;

  if v_orcamento.status = 'Expirado'
    or (
      v_orcamento.validade is not null
      and v_orcamento.validade < (now() at time zone 'America/Sao_Paulo')::date
    ) then
    update public.orcamentos
    set status = 'Expirado',
        bloqueio_temporario_ate = null
    where id = v_orcamento.id;

    raise exception 'Esta proposta está expirada. Entre em contato para solicitar uma atualização.';
  end if;

  if v_orcamento.status not in ('Rascunho', 'Enviado') then
    raise exception 'Esta proposta não aceita mais respostas.';
  end if;

  if p_decisao = 'Aprovado' then
    -- Confere novamente a disponibilidade no momento do aceite.
    for v_linha in
      select distinct item.kit_id
      from public.orcamento_itens item
      where item.orcamento_id = v_orcamento.id
        and item.kit_id is not null
    loop
      v_disponibilidade := public.verificar_disponibilidade_kit(
        v_linha.kit_id,
        coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
        coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
        null
      );

      if not coalesce((v_disponibilidade->>'disponivel')::boolean, false) then
        raise exception '%', coalesce(
          v_disponibilidade->>'motivo',
          'A disponibilidade mudou. Entre em contato para receber uma proposta atualizada.'
        );
      end if;
    end loop;
  end if;

  update public.orcamentos
  set status = p_decisao,
      resposta_cliente = p_decisao,
      respondido_por = left(trim(p_nome), 120),
      respondido_em = v_agora,
      resposta_observacao = nullif(left(trim(coalesce(p_observacao, '')), 1000), ''),
      bloqueio_temporario_ate = case
        when p_decisao = 'Aprovado' then v_agora + interval '24 hours'
        else null
      end
  where id = v_orcamento.id;

  if v_orcamento.oportunidade_id is not null then
    if p_decisao = 'Aprovado' then
      update public.oportunidades
      set jornada_status = 'Cadastro pendente',
          motivo_perda = null
      where id = v_orcamento.oportunidade_id
        and jornada_status <> 'Perdido';
    else
      update public.oportunidades
      set jornada_status = 'Perdido',
          motivo_perda = 'Proposta recusada pelo cliente.'
      where id = v_orcamento.oportunidade_id
        and jornada_status not in ('Reserva confirmada', 'Em operação', 'Concluído');
    end if;
  end if;

  return jsonb_build_object(
    'numero', v_orcamento.numero,
    'status', p_decisao,
    'decisao', p_decisao,
    'respondido_em', v_agora,
    'ja_respondido', false,
    'proximo_passo', case when p_decisao = 'Aprovado'
      then 'Completar cadastro'
      else null
    end,
    'bloqueio_temporario_ate', case when p_decisao = 'Aprovado'
      then v_agora + interval '24 hours'
      else null
    end
  );
end;
$$;

revoke all on function public.registrar_resposta_publica_orcamento(uuid, text, text, text)
from public;

grant execute on function public.registrar_resposta_publica_orcamento(uuid, text, text, text)
to service_role;

-- -----------------------------------------------------------------------------
-- 5. Complemento cadastral após o aceite da proposta
-- -----------------------------------------------------------------------------

create or replace function public.completar_cadastro_publico_orcamento(
  p_token uuid,
  p_nome text,
  p_documento text,
  p_whatsapp text,
  p_email text,
  p_cep text,
  p_endereco text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_cidade text,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_oportunidade public.oportunidades%rowtype;
  v_cliente_id uuid;
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_cep text := regexp_replace(coalesce(p_cep, ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_estado text := upper(trim(coalesce(p_estado, '')));
begin
  if auth.role() <> 'service_role' then
    raise exception 'Esta operação deve ser executada pelo servidor do ERP.';
  end if;

  if length(trim(coalesce(p_nome, ''))) < 3 then
    raise exception 'Informe o nome completo do contratante.';
  end if;

  if length(v_documento) not in (11, 14) then
    raise exception 'Informe um CPF ou CNPJ válido.';
  end if;

  if length(v_whatsapp) < 10 then
    raise exception 'Informe um WhatsApp com DDD.';
  end if;

  if position('@' in v_email) < 2 then
    raise exception 'Informe um e-mail válido.';
  end if;

  if length(v_cep) <> 8
    or length(trim(coalesce(p_endereco, ''))) < 3
    or length(trim(coalesce(p_numero, ''))) < 1
    or length(trim(coalesce(p_bairro, ''))) < 2
    or length(trim(coalesce(p_cidade, ''))) < 2
    or length(v_estado) <> 2 then
    raise exception 'Complete o endereço do contratante antes de continuar.';
  end if;

  select *
  into v_orcamento
  from public.orcamentos
  where public_token = p_token
  for update;

  if not found then
    raise exception 'Proposta não encontrada.';
  end if;

  if v_orcamento.status <> 'Aprovado' then
    raise exception 'A proposta precisa ser aprovada antes do complemento cadastral.';
  end if;

  v_cliente_id := v_orcamento.cliente_id;

  if v_orcamento.oportunidade_id is not null then
    select *
    into v_oportunidade
    from public.oportunidades
    where id = v_orcamento.oportunidade_id
    for update;

    if v_cliente_id is null and found then
      v_cliente_id := v_oportunidade.cliente_id;
    end if;
  end if;

  if v_cliente_id is null then
    select cliente.id
    into v_cliente_id
    from public.clientes cliente
    where regexp_replace(coalesce(cliente.cpf, ''), '\D', '', 'g') = v_documento
       or regexp_replace(coalesce(cliente.whatsapp, ''), '\D', '', 'g') = v_whatsapp
    order by case
      when regexp_replace(coalesce(cliente.cpf, ''), '\D', '', 'g') = v_documento then 0
      else 1
    end
    limit 1;
  end if;

  if v_cliente_id is null then
    insert into public.clientes (
      nome,
      cpf,
      whatsapp,
      email,
      cep,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      origem,
      status,
      observacoes
    ) values (
      trim(p_nome),
      v_documento,
      v_whatsapp,
      v_email,
      v_cep,
      trim(p_endereco),
      trim(p_numero),
      nullif(trim(coalesce(p_complemento, '')), ''),
      trim(p_bairro),
      trim(p_cidade),
      v_estado,
      coalesce(nullif(v_oportunidade.origem, ''), 'Site'),
      'Cliente',
      'Cadastro consolidado após aceite da proposta.'
    )
    returning id into v_cliente_id;
  else
    update public.clientes
    set nome = trim(p_nome),
        cpf = v_documento,
        whatsapp = v_whatsapp,
        email = v_email,
        cep = v_cep,
        endereco = trim(p_endereco),
        numero = trim(p_numero),
        complemento = nullif(trim(coalesce(p_complemento, '')), ''),
        bairro = trim(p_bairro),
        cidade = trim(p_cidade),
        estado = v_estado
    where id = v_cliente_id;
  end if;

  update public.orcamentos
  set cliente_id = v_cliente_id,
      cadastro_completo_em = now()
  where id = v_orcamento.id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set cliente_id = v_cliente_id,
        nome_contato = trim(p_nome),
        celular = v_whatsapp,
        email = v_email,
        jornada_status = 'Contrato pendente',
        motivo_perda = null
    where id = v_orcamento.oportunidade_id;
  end if;

  return jsonb_build_object(
    'cliente_id', v_cliente_id,
    'orcamento_id', v_orcamento.id,
    'cadastro_completo', true,
    'proximo_passo', 'Aguardar contrato',
    'mensagem', 'Dados confirmados. A equipe já pode gerar o contrato para assinatura.'
  );
end;
$$;

revoke all on function public.completar_cadastro_publico_orcamento(
  uuid, text, text, text, text, text, text, text, text, text, text, text
) from public;

grant execute on function public.completar_cadastro_publico_orcamento(
  uuid, text, text, text, text, text, text, text, text, text, text, text
) to service_role;

-- -----------------------------------------------------------------------------
-- 6. Conversão segura: cria estrutura PENDENTE, não uma reserva confirmada
-- -----------------------------------------------------------------------------

create or replace function public.aprovar_orcamento_e_criar_reserva(p_orcamento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_cliente public.clientes%rowtype;
  v_kit_id uuid;
  v_total_kits integer;
  v_disponibilidade jsonb;
  v_reserva_id uuid;
  v_itens text;
  v_linha record;
  v_ordem integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Sua sessão expirou. Entre novamente no ERP.';
  end if;

  select *
  into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id
  for update;

  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;

  if v_orcamento.status <> 'Aprovado' then
    raise exception 'O cliente precisa aprovar a proposta antes da contratação.';
  end if;

  if v_orcamento.cadastro_completo_em is null or v_orcamento.cliente_id is null then
    raise exception 'O cliente precisa completar os dados cadastrais antes da geração do contrato.';
  end if;

  select *
  into v_cliente
  from public.clientes
  where id = v_orcamento.cliente_id;

  if not found
    or length(regexp_replace(coalesce(v_cliente.cpf, ''), '\D', '', 'g')) not in (11, 14)
    or length(regexp_replace(coalesce(v_cliente.whatsapp, ''), '\D', '', 'g')) < 10
    or position('@' in coalesce(v_cliente.email, '')) < 2
    or length(regexp_replace(coalesce(v_cliente.cep, ''), '\D', '', 'g')) <> 8
    or length(trim(coalesce(v_cliente.endereco, ''))) < 3
    or length(trim(coalesce(v_cliente.numero, ''))) < 1
    or length(trim(coalesce(v_cliente.bairro, ''))) < 2
    or length(trim(coalesce(v_cliente.cidade, ''))) < 2
    or length(trim(coalesce(v_cliente.estado, ''))) <> 2 then
    raise exception 'O cadastro do contratante está incompleto. Revise CPF/CNPJ, contato e endereço.';
  end if;

  if v_orcamento.reserva_id is not null then
    return jsonb_build_object(
      'reserva_id', v_orcamento.reserva_id,
      'criada', false,
      'confirmada', exists (
        select 1 from public.reservas reserva
        where reserva.id = v_orcamento.reserva_id
          and reserva.status = 'Confirmada'
      ),
      'mensagem', 'A estrutura da contratação já foi criada para este orçamento.'
    );
  end if;

  select reserva.id
  into v_reserva_id
  from public.reservas reserva
  where reserva.orcamento_id = p_orcamento_id
  limit 1;

  if v_reserva_id is not null then
    update public.orcamentos
    set reserva_id = v_reserva_id
    where id = p_orcamento_id;

    return jsonb_build_object(
      'reserva_id', v_reserva_id,
      'criada', false,
      'confirmada', exists (
        select 1 from public.reservas reserva
        where reserva.id = v_reserva_id
          and reserva.status = 'Confirmada'
      ),
      'mensagem', 'A estrutura existente foi vinculada ao orçamento.'
    );
  end if;

  if v_orcamento.data_evento is null then
    raise exception 'Informe a data do evento antes de continuar.';
  end if;

  select count(*)::integer
  into v_total_kits
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id
    and item.kit_id is not null;

  if v_total_kits = 0 then
    raise exception 'Adicione pelo menos um kit ao orçamento antes da contratação.';
  end if;

  if exists (
    select 1
    from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id
      and item.kit_id is not null
      and item.quantidade <> 1
  ) then
    raise exception 'Cada kit deve ser incluído em uma linha individual.';
  end if;

  if exists (
    select 1
    from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id
      and item.kit_id is not null
    group by item.kit_id
    having count(*) > 1
  ) then
    raise exception 'O mesmo kit não pode aparecer em mais de uma linha do orçamento.';
  end if;

  for v_linha in
    select distinct item.kit_id
    from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id
      and item.kit_id is not null
  loop
    v_disponibilidade := public.verificar_disponibilidade_kit(
      v_linha.kit_id,
      coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
      coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
      null
    );

    if not coalesce((v_disponibilidade->>'disponivel')::boolean, false) then
      raise exception '%', coalesce(
        v_disponibilidade->>'motivo',
        'Um dos kits não está disponível no período informado.'
      );
    end if;
  end loop;

  select item.kit_id
  into v_kit_id
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id
    and item.kit_id is not null
  order by item.created_at
  limit 1;

  select string_agg(
    trim(to_char(item.quantidade, 'FM999999990D00')) || 'x ' ||
    item.descricao || ' — R$ ' ||
    trim(to_char(item.subtotal, 'FM999999990D00')),
    E'\n' order by item.created_at
  )
  into v_itens
  from public.orcamento_itens item
  where item.orcamento_id = p_orcamento_id;

  insert into public.reservas (
    cliente_id,
    kit_id,
    data_evento,
    horario_evento,
    endereco_evento,
    valor_total,
    valor_sinal,
    status,
    observacoes,
    data_retirada,
    data_devolucao,
    status_comercial,
    status_operacional,
    status_pagamento,
    orcamento_id
  ) values (
    v_orcamento.cliente_id,
    v_kit_id,
    v_orcamento.data_evento,
    v_orcamento.horario_evento,
    v_orcamento.endereco_evento,
    v_orcamento.total,
    0,
    'Pendente',
    concat_ws(
      E'\n\n',
      'Contratação iniciada pelo ORC-' || lpad(v_orcamento.numero::text, 4, '0') || '.',
      'Esta reserva somente será confirmada após assinatura do contrato e pagamento do sinal.',
      nullif(v_orcamento.observacoes, ''),
      'Itens do orçamento:' || E'\n' || coalesce(v_itens, '-')
    ),
    coalesce(v_orcamento.data_retirada, v_orcamento.data_evento),
    coalesce(v_orcamento.data_devolucao, v_orcamento.data_evento),
    'Em contratação',
    'Aguardando confirmação',
    'Pendente',
    p_orcamento_id
  )
  returning id into v_reserva_id;

  for v_linha in
    select *
    from public.orcamento_itens item
    where item.orcamento_id = p_orcamento_id
    order by item.created_at
  loop
    v_ordem := v_ordem + 1;

    insert into public.reserva_itens (
      reserva_id,
      kit_id,
      descricao,
      quantidade,
      valor_unitario,
      ordem
    ) values (
      v_reserva_id,
      v_linha.kit_id,
      v_linha.descricao,
      case when v_linha.kit_id is not null then 1 else v_linha.quantidade end,
      case when v_linha.kit_id is not null then v_linha.subtotal else v_linha.valor_unitario end,
      v_ordem
    );
  end loop;

  if coalesce(v_orcamento.desconto, 0) > 0 then
    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, descricao, quantidade, valor_unitario, ordem
    ) values (
      v_reserva_id, 'Desconto comercial', 1, -v_orcamento.desconto, v_ordem
    );
  end if;

  if coalesce(v_orcamento.acrescimos, 0) > 0 then
    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, descricao, quantidade, valor_unitario, ordem
    ) values (
      v_reserva_id, 'Acréscimos', 1, v_orcamento.acrescimos, v_ordem
    );
  end if;

  if coalesce(v_orcamento.frete, 0) > 0 then
    v_ordem := v_ordem + 1;
    insert into public.reserva_itens (
      reserva_id, descricao, quantidade, valor_unitario, ordem
    ) values (
      v_reserva_id, 'Frete', 1, v_orcamento.frete, v_ordem
    );
  end if;

  update public.orcamentos
  set reserva_id = v_reserva_id
  where id = p_orcamento_id;

  if v_orcamento.oportunidade_id is not null then
    update public.oportunidades
    set jornada_status = 'Contrato pendente',
        motivo_perda = null
    where id = v_orcamento.oportunidade_id
      and jornada_status <> 'Perdido';
  end if;

  return jsonb_build_object(
    'reserva_id', v_reserva_id,
    'criada', true,
    'confirmada', false,
    'mensagem', 'Contratação criada. A reserva ainda está pendente de contrato e pagamento.'
  );
end;
$$;

-- Mantém a política de execução definida no RBAC: navegador autenticado pode usar
-- a conversão, enquanto a formalização completa continua passando pelo servidor.
revoke all on function public.aprovar_orcamento_e_criar_reserva(uuid) from public;
grant execute on function public.aprovar_orcamento_e_criar_reserva(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Invariante central: somente contrato assinado + sinal pago confirmam reserva
-- -----------------------------------------------------------------------------

create or replace function public.sincronizar_reserva_com_formalizacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reserva_id is null then
    return new;
  end if;

  if new.formalizacao_status = 'Venda confirmada' then
    update public.reservas
    set status = case
          when status = 'Pendente' then 'Confirmada'
          else status
        end,
        status_comercial = 'Confirmada',
        status_operacional = case
          when status_operacional in ('Aguardando confirmação', 'Aguardando operação')
            then 'Aguardando operação'
          else status_operacional
        end
    where id = new.reserva_id;

    if new.oportunidade_id is not null then
      update public.oportunidades
      set jornada_status = 'Reserva confirmada',
          motivo_perda = null
      where id = new.oportunidade_id;
    end if;

  elsif new.formalizacao_status = 'Aguardando sinal' then
    update public.reservas
    set status_comercial = case when status = 'Pendente' then 'Em contratação' else status_comercial end
    where id = new.reserva_id;

    if new.oportunidade_id is not null then
      update public.oportunidades
      set jornada_status = 'Pagamento pendente',
          motivo_perda = null
      where id = new.oportunidade_id
        and jornada_status not in ('Reserva confirmada', 'Em operação', 'Concluído', 'Perdido');
    end if;

  elsif new.formalizacao_status = 'Aguardando contrato' then
    update public.reservas
    set status_comercial = case when status = 'Pendente' then 'Em contratação' else status_comercial end
    where id = new.reserva_id;

    if new.oportunidade_id is not null then
      update public.oportunidades
      set jornada_status = 'Assinatura pendente',
          motivo_perda = null
      where id = new.oportunidade_id
        and jornada_status not in ('Reserva confirmada', 'Em operação', 'Concluído', 'Perdido');
    end if;

  elsif new.formalizacao_status = 'Aguardando formalização' then
    update public.reservas
    set status_comercial = case when status = 'Pendente' then 'Em contratação' else status_comercial end
    where id = new.reserva_id;

    if new.oportunidade_id is not null then
      update public.oportunidades
      set jornada_status = 'Contrato pendente',
          motivo_perda = null
      where id = new.oportunidade_id
        and jornada_status not in ('Reserva confirmada', 'Em operação', 'Concluído', 'Perdido');
    end if;

  elsif new.formalizacao_status = 'Cancelada' then
    update public.reservas
    set status = case when status = 'Pendente' then 'Cancelada' else status end,
        status_comercial = case when status = 'Pendente' then 'Cancelada' else status_comercial end
    where id = new.reserva_id;

    if new.oportunidade_id is not null then
      update public.oportunidades
      set jornada_status = 'Perdido',
          motivo_perda = coalesce(motivo_perda, 'Contratação cancelada.')
      where id = new.oportunidade_id
        and jornada_status not in ('Em operação', 'Concluído');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orcamentos_sincronizar_reserva_formalizacao
on public.orcamentos;

create trigger orcamentos_sincronizar_reserva_formalizacao
after insert or update of formalizacao_status, reserva_id
on public.orcamentos
for each row
when (
  new.reserva_id is not null
  and new.formalizacao_status is not null
)
execute function public.sincronizar_reserva_com_formalizacao();

-- Corrige apenas registros ainda pendentes de formalização. Reservas operacionais
-- históricas/confirmadas não são rebaixadas automaticamente por esta migração.
update public.reservas reserva
set status_comercial = 'Em contratação',
    status_operacional = case
      when reserva.status_operacional = 'Aguardando operação' then 'Aguardando confirmação'
      else reserva.status_operacional
    end
from public.orcamentos orcamento
where orcamento.reserva_id = reserva.id
  and reserva.status = 'Pendente'
  and coalesce(orcamento.formalizacao_status, '') <> 'Venda confirmada';

-- -----------------------------------------------------------------------------
-- 8. Site: novas pré-reservas sem CPF e sem caução, integradas ao funil
-- -----------------------------------------------------------------------------

create schema if not exists private;

create or replace function private.criar_pre_reserva_site_impl(
  p_kit_id uuid,
  p_data_festa date,
  p_nome text,
  p_whatsapp text,
  p_email text,
  p_cpf text default null,
  p_valor_kit numeric default 0,
  p_caucao numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_codigo text;
  v_kit public.kits%rowtype;
  v_disp jsonb;
  v_valor numeric;
  v_whatsapp text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_empresa_id uuid;
  v_oportunidade_id uuid;
begin
  if p_data_festa < current_date then
    raise exception 'Escolha uma data futura.' using errcode = '22007';
  end if;

  if length(trim(coalesce(p_nome, ''))) < 2
    or length(v_whatsapp) < 10
    or position('@' in v_email) < 2 then
    raise exception 'Dados do cliente inválidos.' using errcode = '22023';
  end if;

  select *
  into v_kit
  from public.kits
  where id = p_kit_id
    and status ilike 'Disponível';

  if not found then
    raise exception 'Kit não encontrado ou indisponível.' using errcode = 'P0002';
  end if;

  select public.verificar_disponibilidade_kit(
    p_kit_id,
    p_data_festa,
    p_data_festa,
    null
  )::jsonb
  into v_disp;

  if coalesce((v_disp->>'disponivel')::boolean, false) = false then
    raise exception 'Este kit não está disponível na data escolhida.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.site_pre_reservas
    where kit_id = p_kit_id
      and data_festa = p_data_festa
      and whatsapp = v_whatsapp
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'Este pedido já foi recebido. Aguarde a análise da equipe.' using errcode = '23505';
  end if;

  v_valor := case
    when extract(isodow from p_data_festa) in (6, 7)
      and coalesce(v_kit.valor_fim_semana, 0) > 0
      then v_kit.valor_fim_semana
    else coalesce(v_kit.valor, 0)
  end;

  select empresa.id
  into v_empresa_id
  from public.empresas empresa
  where coalesce(empresa.status, 'Ativa') = 'Ativa'
  order by empresa.created_at
  limit 1;

  insert into public.oportunidades (
    empresa_id,
    nome_contato,
    celular,
    email,
    origem,
    interesse,
    data_evento,
    valor_estimado,
    etapa,
    jornada_status,
    observacoes
  ) values (
    v_empresa_id,
    trim(p_nome),
    v_whatsapp,
    v_email,
    'Site',
    concat_ws(' ', 'Kit', nullif(v_kit.codigo, ''), '-', v_kit.nome),
    p_data_festa,
    v_valor,
    'Novo contato',
    'Pré-reserva',
    'Pré-reserva recebida automaticamente pelo site. Dados contratuais ainda não solicitados.'
  )
  returning id into v_oportunidade_id;

  v_codigo := 'CP-' ||
    to_char(clock_timestamp(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.site_pre_reservas (
    codigo,
    kit_id,
    data_festa,
    nome,
    whatsapp,
    email,
    cpf,
    valor_kit,
    caucao,
    status,
    oportunidade_id
  ) values (
    v_codigo,
    p_kit_id,
    p_data_festa,
    trim(p_nome),
    v_whatsapp,
    v_email,
    null,
    v_valor,
    0,
    'Em análise',
    v_oportunidade_id
  );

  return jsonb_build_object(
    'codigo', v_codigo,
    'oportunidade_id', v_oportunidade_id,
    'status', 'Em análise',
    'mensagem', 'Pré-reserva recebida. A equipe analisará a disponibilidade e enviará a proposta.'
  );
end;
$$;

-- Mantém a assinatura antiga para não quebrar o site já publicado, porém CPF e
-- caução são ignorados pela implementação nova.
create or replace function public.criar_pre_reserva_site(
  p_kit_id uuid,
  p_data_festa date,
  p_nome text,
  p_whatsapp text,
  p_email text,
  p_cpf text default null,
  p_valor_kit numeric default 0,
  p_caucao numeric default 0
)
returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select private.criar_pre_reserva_site_impl(
    p_kit_id,
    p_data_festa,
    p_nome,
    p_whatsapp,
    p_email,
    null,
    p_valor_kit,
    0
  );
$$;

revoke all on function private.criar_pre_reserva_site_impl(
  uuid, date, text, text, text, text, numeric, numeric
) from public;

revoke all on function public.criar_pre_reserva_site(
  uuid, date, text, text, text, text, numeric, numeric
) from public;

grant execute on function public.criar_pre_reserva_site(
  uuid, date, text, text, text, text, numeric, numeric
) to anon, authenticated, service_role;

commit;
