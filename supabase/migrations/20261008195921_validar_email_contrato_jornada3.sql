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
  if v_orcamento.status is distinct from 'ACEITA' then
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
