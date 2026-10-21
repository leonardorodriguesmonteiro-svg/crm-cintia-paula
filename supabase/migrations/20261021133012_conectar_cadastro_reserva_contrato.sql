create or replace function public.normalizar_status_proposta_formalizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- A Application Layer usa esta chave apenas dentro da mesma transação para
  -- chamar RPCs históricas que ainda validam o texto "Aprovado".
  if current_setting('app.permitir_status_comercial_legado', true) = 'true' then
    return new;
  end if;

  new.status := case new.status
    when 'Rascunho' then 'RASCUNHO'
    when 'Enviado' then 'ENVIADA'
    when 'Aprovado' then case when new.origem_externa_id = 'pre-reserva:' || new.oportunidade_id::text then 'Aprovado' else 'ACEITA' end
    when 'Recusado' then 'RECUSADA'
    when 'Expirado' then 'EXPIRADA'
    else new.status
  end;

  new.resposta_cliente := case new.resposta_cliente
    when 'Aprovado' then 'ACEITA'
    when 'Recusado' then 'RECUSADA'
    else new.resposta_cliente
  end;

  new.formalizacao_status := case new.formalizacao_status
    when 'Aguardando formalização' then 'AGUARDANDO_DADOS'
    when 'Aguardando contrato' then 'AGUARDANDO_ASSINATURA'
    when 'Aguardando sinal' then 'AGUARDANDO_PAGAMENTO'
    when 'Venda confirmada' then 'RESERVA_CONFIRMADA'
    when 'Cancelada' then 'CANCELADA'
    else new.formalizacao_status
  end;

  if new.status = 'ACEITA' and new.formalizacao_status is null then
    new.formalizacao_status := 'AGUARDANDO_DADOS';
  elsif new.status in ('RECUSADA', 'EXPIRADA', 'CANCELADA')
    and new.formalizacao_status is distinct from 'RESERVA_CONFIRMADA'
  then
    new.formalizacao_status := 'CANCELADA';
  end if;

  return new;
end;
$$;

revoke all on function public.normalizar_status_proposta_formalizacao()
from public;


-- Cadastro aprovado cria apenas reserva provisória. Sinal e contrato exigem ação do Comercial.
create or replace function public.preparar_reserva_pre_reserva(p_empresa_id uuid,p_oportunidade_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_pedido public.oportunidades%rowtype; v_orcamento public.orcamentos%rowtype;
 p_orcamento_id uuid; v_reserva_id uuid; v_kit_id uuid; v_linha record;
 v_ordem integer:=0; v_total_snapshot numeric;
begin
 select * into v_pedido from public.oportunidades where id=p_oportunidade_id and empresa_id=p_empresa_id for update;
 if not found or v_pedido.etapa not in ('APROVADA','CONVERTIDA_EM_PROPOSTA') or v_pedido.cadastro_completo_em is null or v_pedido.cliente_id is null then
  raise exception 'O pedido precisa estar aprovado e com cadastro completo.' using errcode='22023';
 end if;
 select * into v_orcamento from public.orcamentos where oportunidade_id=p_oportunidade_id and empresa_id=p_empresa_id order by created_at desc limit 1 for update;
 if found then
  -- Uma proposta preparada separadamente continua pela sua própria aprovação.
  if v_orcamento.origem_externa_id is distinct from 'pre-reserva:' || p_oportunidade_id::text then
   return jsonb_build_object('orcamento_id',v_orcamento.id,'reserva_id',v_orcamento.reserva_id,'revisao_pendente',true);
  end if;
  if v_orcamento.reserva_id is not null then
   return jsonb_build_object('orcamento_id',v_orcamento.id,'reserva_id',v_orcamento.reserva_id,'ja_preparada',true);
  end if;
 else
  if v_pedido.data_evento is null or not exists(select 1 from public.oportunidade_itens where oportunidade_id=p_oportunidade_id) or exists(select 1 from public.oportunidade_itens where oportunidade_id=p_oportunidade_id and valor_referencia is null) then
   raise exception 'Peça à equipe para completar a data e os preços do orçamento.' using errcode='22023';
  end if;
  insert into public.orcamentos(empresa_id,oportunidade_id,cliente_id,status,origem,origem_externa_id,contato_nome,contato_telefone,contato_email,tema_evento,data_evento,data_retirada,data_devolucao,observacoes,desconto_tipo,desconto_valor,dados_cliente_completos_em,formalizacao_status)
  values(p_empresa_id,p_oportunidade_id,v_pedido.cliente_id,'Aprovado','SITE','pre-reserva:'||p_oportunidade_id::text,v_pedido.nome_contato,v_pedido.celular,v_pedido.email,v_pedido.interesse,v_pedido.data_evento,v_pedido.data_evento,v_pedido.data_evento,v_pedido.observacoes,v_pedido.desconto_tipo,v_pedido.desconto_valor,v_pedido.cadastro_completo_em,'DADOS_COMPLETOS') returning id into p_orcamento_id;
  insert into public.orcamento_itens(orcamento_id,kit_id,estoque_item_id,tipo_origem,descricao,quantidade,valor_unitario,preco_base,preco_unitario_orcamento,observacao,ordem)
  select p_orcamento_id,kit_id,estoque_item_id,case tipo when 'ITEM_ESTOQUE' then 'ESTOQUE' else tipo end,nome_snapshot,quantidade,valor_referencia,valor_referencia,valor_referencia,observacoes,ordem
  from public.oportunidade_itens where oportunidade_id=p_oportunidade_id and empresa_id=p_empresa_id order by ordem,created_at,id;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id;
  if v_orcamento.total <> v_pedido.valor_estimado then
   raise exception 'O total aprovado não corresponde aos itens. Peça à equipe para revisar o orçamento.' using errcode='22023';
  end if;
 end if;
 p_orcamento_id:=v_orcamento.id;
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
      v_orcamento.cliente_id,v_kit_id,v_orcamento.data_evento,v_orcamento.horario_evento,v_orcamento.endereco_evento,v_orcamento.total,0,'Pendente',
      concat_ws(E'\n\n','Reserva provisória gerada pela proposta ORC-'||lpad(v_orcamento.numero::text,4,'0')||'.','O estoque será bloqueado somente após assinatura do contrato e pagamento do sinal.',nullif(v_orcamento.observacoes,'')),
      coalesce(v_orcamento.data_retirada,v_orcamento.data_evento),v_orcamento.horario_retirada,coalesce(v_orcamento.data_devolucao,v_orcamento.data_evento),
      'Aguardando formalização','Aguardando confirmação','Pendente',p_orcamento_id
    ) returning id into v_reserva_id;

    for v_linha in
      select * from public.orcamento_itens item
      where item.orcamento_id=p_orcamento_id
      order by item.ordem, item.created_at, item.id
    loop
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens (
        reserva_id,kit_id,estoque_item_id,descricao,quantidade,valor_unitario,ordem
      ) values (
        v_reserva_id,
        v_linha.kit_id,
        v_linha.estoque_item_id,
        v_linha.descricao || case when v_linha.tipo_origem='CONCEITUAL' then ' (item conceitual: aquisição ou produção necessária)' else '' end,
        case when v_linha.kit_id is not null then 1 else v_linha.quantidade end,
        coalesce(v_linha.preco_unitario_orcamento,v_linha.valor_unitario),
        v_ordem
      );
      if coalesce(v_linha.desconto,0)>0 then
        v_ordem:=v_ordem+1;
        insert into public.reserva_itens(reserva_id,descricao,quantidade,valor_unitario,ordem)
        values(v_reserva_id,'Desconto do item: '||v_linha.descricao,1,-v_linha.desconto,v_ordem);
      end if;
    end loop;

    for v_linha in select * from public.orcamento_taxas where orcamento_id=p_orcamento_id order by ordem,id loop
      v_ordem:=v_ordem+1;
      insert into public.reserva_itens(reserva_id,descricao,quantidade,valor_unitario,ordem)
      values(v_reserva_id,v_linha.descricao,1,v_linha.valor,v_ordem);
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
  end if;
  select coalesce(sum(subtotal),0) into v_total_snapshot from public.reserva_itens where reserva_id=v_reserva_id;
  if v_total_snapshot <> v_orcamento.total then
    raise exception 'Os itens do contrato não correspondem ao total aceito. Revise a composição antes de formalizar.';
  end if;


 update public.orcamentos set reserva_id=v_reserva_id where id=p_orcamento_id;
 update public.oportunidades set etapa='CONVERTIDA_EM_PROPOSTA',versao=versao+1,updated_at=now() where id=p_oportunidade_id and etapa<>'CONVERTIDA_EM_PROPOSTA';
 return jsonb_build_object('orcamento_id',p_orcamento_id,'reserva_id',v_reserva_id,'ja_preparada',false);
end; $$;
revoke all on function public.preparar_reserva_pre_reserva(uuid,uuid) from public,anon,authenticated;
grant execute on function public.preparar_reserva_pre_reserva(uuid,uuid) to service_role;

-- Corrige reenvio de cadastro de cliente existente sem substituir seus dados.
create or replace function public.completar_cadastro_pre_reserva(p_empresa_id uuid,p_token_hash text,p_dados jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_cliente uuid; v_pedido public.oportunidades%rowtype; v_documento text; v_telefone text; v_encontrados uuid[];
begin
 select oportunidade_id into v_id from public.acompanhamento_links
 where token_hash=p_token_hash and revoked_at is null and expires_at>now() for update;
 if v_id is null then raise exception 'Link inválido ou expirado.' using errcode='22023'; end if;
 select * into v_pedido from public.oportunidades where id=v_id and empresa_id=p_empresa_id for update;
 if not found then raise exception 'Pedido não encontrado.' using errcode='22023'; end if;
 if v_pedido.cadastro_completo_em is not null then
  perform public.preparar_reserva_pre_reserva(p_empresa_id,v_id);
  return jsonb_build_object('sucesso',true,'ja_completo',true);
 end if;
 if v_pedido.etapa not in ('APROVADA','CONVERTIDA_EM_PROPOSTA') or exists(select 1 from public.orcamentos where oportunidade_id=v_id and status<>'RASCUNHO') then
  raise exception 'O cadastro não está disponível nesta etapa. Fale com a equipe.' using errcode='22023';
 end if;
 if coalesce(p_dados->>'cpf','') !~ '^([0-9]{11}|[0-9]{14})$' or coalesce(p_dados->>'cep','') !~ '^[0-9]{8}$'
 or length(coalesce(p_dados->>'endereco','')) not between 2 and 300
 or length(coalesce(p_dados->>'numero','')) not between 1 and 30
 or length(coalesce(p_dados->>'bairro','')) not between 2 and 120
 or length(coalesce(p_dados->>'cidade','')) not between 2 and 120
 or coalesce(p_dados->>'estado','') !~ '^[A-Z]{2}$'
 or coalesce(p_dados->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
  raise exception 'Dados cadastrais inválidos.' using errcode='22023';
 end if;
 -- Reuse only when BOTH document and order contact identify the same customer.
 -- A document or phone alone must never update an unrelated customer.
 v_documento := p_dados->>'cpf';
 v_telefone := regexp_replace(coalesce(v_pedido.celular,''),'[^0-9]','','g');
 perform pg_advisory_xact_lock(hashtextextended('cadastro-documento:'||v_documento,0));
 perform pg_advisory_xact_lock(hashtextextended('cadastro-telefone:'||v_telefone,0));
 select array_agg(id) into v_encontrados from public.clientes
 where regexp_replace(coalesce(case when length(v_documento)=11 then cpf else cnpj end,''),'[^0-9]','','g')=v_documento
   and regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g')=v_telefone;
 if cardinality(v_encontrados)>1 then
   raise exception 'Não foi possível confirmar o cadastro existente. Peça à equipe para revisar o vínculo do cliente.' using errcode='22023';
 end if;
 v_cliente := v_encontrados[1];
 if v_pedido.cliente_id is not null and v_cliente is distinct from v_pedido.cliente_id then
   raise exception 'Os dados não correspondem ao cliente vinculado ao pedido. Peça à equipe para revisar o cadastro.' using errcode='22023';
 end if;
 if v_cliente is not null then
   -- Fill missing information only; retain established customer identity and data.
   update public.clientes set
     email=coalesce(nullif(trim(email),''),p_dados->>'email'),
     cep=coalesce(nullif(trim(cep),''),p_dados->>'cep'),
     endereco=coalesce(nullif(trim(endereco),''),p_dados->>'endereco'),
     numero=coalesce(nullif(trim(numero),''),p_dados->>'numero'),
     complemento=coalesce(nullif(trim(complemento),''),nullif(p_dados->>'complemento','')),
     bairro=coalesce(nullif(trim(bairro),''),p_dados->>'bairro'),
     cidade=coalesce(nullif(trim(cidade),''),p_dados->>'cidade'),
     estado=coalesce(nullif(trim(estado),''),p_dados->>'estado')
   where id=v_cliente;
 else
   if exists(select 1 from public.clientes
     where regexp_replace(coalesce(case when length(v_documento)=11 then cpf else cnpj end,''),'[^0-9]','','g')=v_documento
        or regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g')=v_telefone) then
     raise exception 'Já existe um cadastro com dados diferentes. Peça à equipe para conferir o documento e o telefone antes de continuar.' using errcode='22023';
   end if;
   insert into public.clientes(nome,cpf,cnpj,whatsapp,email,cep,endereco,numero,complemento,bairro,cidade,estado,origem,status)
   values(v_pedido.nome_contato,case when length(v_documento)=11 then v_documento else null end,case when length(v_documento)=14 then v_documento else null end,v_pedido.celular,p_dados->>'email',p_dados->>'cep',p_dados->>'endereco',p_dados->>'numero',p_dados->>'complemento',p_dados->>'bairro',p_dados->>'cidade',p_dados->>'estado','Site','Cliente') returning id into v_cliente;
 end if;
 update public.oportunidades set cliente_id=v_cliente,email=p_dados->>'email',cadastro_completo_em=now(),updated_at=now() where id=v_id;
 update public.orcamentos set cliente_id=v_cliente,dados_cliente_completos_em=now() where oportunidade_id=v_id and empresa_id=p_empresa_id and status='RASCUNHO';
 perform public.preparar_reserva_pre_reserva(p_empresa_id,v_id);
 return jsonb_build_object('sucesso',true,'ja_completo',false);
end; $$;

revoke all on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) to service_role;

create or replace function public.executar_formalizacao_servidor(
  p_usuario_id uuid,p_orcamento_id uuid,p_acao text,p_valor_sinal numeric default null,p_vencimento date default null,p_forma_pagamento text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_orcamento public.orcamentos%rowtype;
  v_perfil text;
  v_resultado jsonb := '{}'::jsonb;
  v_repetida boolean := false;
begin
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id for update;
  if not found then raise exception using errcode='P0002',message='Proposta não encontrada.'; end if;
  select perfil into v_perfil from public.usuarios_empresa
    where usuario_id=p_usuario_id and empresa_id=v_orcamento.empresa_id and ativo
    order by case perfil when 'Administrador' then 0 when 'Comercial' then 1 else 2 end limit 1;
  if v_perfil is null or
    (p_acao in ('formalizar','confirmar_assinatura') and v_perfil not in ('Administrador','Comercial')) or
    (p_acao='confirmar_sinal' and v_perfil not in ('Administrador','Comercial','Financeiro')) then
    raise exception using errcode='42501',message='Usuário sem permissão para formalizar esta proposta.';
  end if;
  if p_acao is null or p_acao not in ('formalizar','confirmar_assinatura','confirmar_sinal') then
    raise exception using errcode='22023',message='Ação de formalização inválida.';
  end if;
  if v_orcamento.status is distinct from 'ACEITA' and not (v_orcamento.status='Aprovado' and v_orcamento.origem_externa_id = 'pre-reserva:' || v_orcamento.oportunidade_id::text) then
    raise exception using errcode='23514',message='A proposta precisa estar aceita.';
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id,'role','authenticated')::text,true);
  perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  perform set_config('app.usuario_id',p_usuario_id::text,true);
  if p_acao='formalizar' then
    if v_orcamento.contrato_id is not null and v_orcamento.reserva_id is not null and v_orcamento.lancamento_sinal_id is not null then
      v_repetida:=true;
    else
      if v_orcamento.formalizacao_status <> 'DADOS_COMPLETOS' or v_orcamento.dados_cliente_completos_em is null or v_orcamento.cliente_id is null then
        raise exception using errcode='23514',message='Complete os dados do cliente antes de gerar o contrato.';
      end if;
      if not exists(
        select 1 from public.clientes where id=v_orcamento.cliente_id
          and length(trim(coalesce(email,''))) between 3 and 254
          and trim(email) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      ) then
        raise exception using errcode='23514',message='Cadastre um e-mail válido do cliente antes de gerar o contrato.';
      end if;
      v_resultado:=public.formalizar_orcamento_aprovado(p_orcamento_id,p_valor_sinal,p_vencimento);
    end if;
  elsif p_acao='confirmar_assinatura' then
    v_resultado:=public.confirmar_assinatura_formalizacao(p_orcamento_id);
  elsif p_acao='confirmar_sinal' then
    v_resultado:=public.confirmar_pagamento_sinal_formalizacao(p_orcamento_id,p_forma_pagamento);
  end if;
  select * into v_orcamento from public.orcamentos where id=p_orcamento_id;
  return v_resultado || jsonb_build_object(
    'status',v_orcamento.formalizacao_status,
    'reserva_id',v_orcamento.reserva_id,'contrato_id',v_orcamento.contrato_id,
    'lancamento_sinal_id',v_orcamento.lancamento_sinal_id,
    'ja_formalizada',v_repetida,
    'mensagem',case
      when v_repetida then 'Contrato e cobrança já preparados. Os valores existentes foram preservados.'
      when coalesce((v_resultado->>'bloqueada')::boolean,false) then v_resultado->>'motivo'
      when v_orcamento.formalizacao_status='CONTRATO_GERADO' then 'Contrato e cobrança preparados. Aguardando envio e assinatura.'
      when v_orcamento.formalizacao_status='AGUARDANDO_ASSINATURA' then 'Aguardando assinatura do contrato.'
      when v_orcamento.formalizacao_status='AGUARDANDO_PAGAMENTO' then 'Contrato assinado. Aguardando pagamento do sinal.'
      when v_orcamento.formalizacao_status='RESERVA_CONFIRMADA' then 'Formalização concluída e reserva confirmada.'
      else coalesce(v_resultado->>'mensagem','Formalização atualizada.') end
  );
end;
$$;
revoke all on function public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text) from public,anon,authenticated;
grant execute on function public.executar_formalizacao_servidor(uuid,uuid,text,numeric,date,text) to service_role;
revoke all on function public.formalizar_orcamento_aprovado(uuid,numeric,date) from public,anon,authenticated;
