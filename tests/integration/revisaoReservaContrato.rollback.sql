begin;
do $$
declare
 e uuid; u uuid; k uuid; o uuid; q uuid; r uuid; c uuid; resultado jsonb; repetido jsonb;
 token text:=encode(gen_random_bytes(32),'hex'); dados jsonb;
 estoque_antes numeric; total_antes bigint; antigo uuid; novo uuid; ledger uuid; snap jsonb; linhas jsonb;
begin
 select empresa_id,usuario_id into e,u from public.usuarios_empresa where ativo and perfil in ('Administrador','Comercial') limit 1;
 select id into k from public.estoque_itens where quantidade_disponivel>=2 and status is distinct from 'Inativo' limit 1;
 estoque_antes:=public.quantidade_estoque_comprometida(k,'2099-02-10','2099-02-10',null);
 select count(*) into total_antes from public.reservas;
 insert into public.oportunidades(empresa_id,nome_contato,celular,etapa,origem,data_evento,desconto_tipo,desconto_valor)
 values(e,'Teste transacional cadastro reserva','11987650001','APROVADA','Site','2099-02-10','PERCENTUAL',10) returning id into o;
 insert into public.oportunidade_itens(empresa_id,oportunidade_id,tipo,estoque_item_id,nome_snapshot,quantidade,valor_referencia)
 values(e,o,'ITEM_ESTOQUE',k,'Item com preço negociado',2,100.10);
 insert into public.acompanhamento_links(oportunidade_id,token_hash,expires_at) values(o,token,now()+interval '1 hour');
 dados:='{"cpf":"98765430001","email":"teste@example.com","cep":"01001000","endereco":"Rua de teste","numero":"10","bairro":"Centro","cidade":"São Paulo","estado":"SP"}';
 resultado:=public.completar_cadastro_pre_reserva(e,token,dados);
 select id,reserva_id,cliente_id into q,r,c from public.orcamentos where oportunidade_id=o;
 if q is null or r is null or c is null then raise exception 'Cadastro não criou os vínculos'; end if;
 if not exists(select 1 from public.orcamentos where id=q and status='Aprovado' and resposta_cliente is null and respondido_em is null and total=180.18 and contrato_id is null and lancamento_sinal_id is null and formalizacao_status='DADOS_COMPLETOS') then raise exception 'Aprovação, total ou etapa incorretos'; end if;
 if not exists(select 1 from public.reservas where id=r and status='Pendente' and valor_total=180.18 and valor_sinal=0) then raise exception 'Reserva não provisória'; end if;
 if (select sum(subtotal) from public.reserva_itens where reserva_id=r)<>180.18 then raise exception 'Snapshot não preservado'; end if;
 if public.quantidade_estoque_comprometida(k,'2099-02-10','2099-02-10',null)<>estoque_antes then raise exception 'Estoque bloqueado antecipadamente'; end if;
 repetido:=public.completar_cadastro_pre_reserva(e,token,dados);
 if not (repetido->>'ja_completo')::boolean or (select count(*) from public.reservas)<>total_antes+1 or (select count(*) from public.orcamentos where oportunidade_id=o)<>1 then raise exception 'Repetição duplicou dados'; end if;
 begin
  perform public.preparar_reserva_pre_reserva(gen_random_uuid(),o);
  raise exception 'Empresa diferente permitida';
 exception when invalid_parameter_value then null; end;
 begin
  update public.reservas set status='Confirmada' where id=r;
  raise exception 'Reserva confirmada sem assinatura ou pagamento';
 exception when check_violation then null; end;
 begin
  update public.orcamentos set origem_externa_id=null where id=q;
  perform public.executar_formalizacao_servidor(u,q,'formalizar',50,'2099-02-09',null);
  raise exception 'Aprovação sem origem permitida';
 exception when check_violation then null; end;
 begin
  perform public.executar_formalizacao_servidor(gen_random_uuid(),q,'formalizar',50,'2099-02-09',null);
  raise exception 'Usuário indevido permitiu liberação';
 exception when insufficient_privilege then null; end;
 begin
  perform public.executar_formalizacao_servidor(u,q,'formalizar',0,'2099-02-09',null);
  raise exception 'Sinal zero permitido';
 exception when raise_exception then if sqlerrm='Sinal zero permitido' then raise; end if; end;
 resultado:=public.executar_formalizacao_servidor(u,q,'formalizar',50,'2099-02-09',null);
 if resultado->>'reserva_id'<>r::text or resultado->>'status'<>'CONTRATO_GERADO' then raise exception 'Formalização não reutilizou reserva %',resultado; end if;
 repetido:=public.executar_formalizacao_servidor(u,q,'formalizar',90,'2099-02-08',null);
 if repetido->>'contrato_id'<>resultado->>'contrato_id' or not (repetido->>'ja_formalizada')::boolean then raise exception 'Contrato duplicado'; end if;
 if not exists(select 1 from public.lancamentos_financeiros where id=(resultado->>'lancamento_sinal_id')::uuid and valor=50 and data_vencimento='2099-02-09') then raise exception 'Condições do sinal alteradas'; end if;
 resultado:=public.registrar_assinatura_publica_contrato((select public_token from public.contratos where id=(resultado->>'contrato_id')::uuid),'Teste transacional cadastro reserva','98765430001',null,'Teste rollback');
 if resultado->>'status'<>'AGUARDANDO_PAGAMENTO' then raise exception 'Assinatura confirmou sem pagamento'; end if;
 resultado:=public.executar_formalizacao_servidor(u,q,'confirmar_sinal',null,null,'Pix');
 if resultado->>'status'<>'RESERVA_CONFIRMADA' then raise exception 'Reserva não confirmou %',resultado; end if;
 if public.quantidade_estoque_comprometida(k,'2099-02-10','2099-02-10',null)<>estoque_antes+2 then raise exception 'Estoque confirmado incorreto'; end if;

 select contrato_id,lancamento_sinal_id into antigo,ledger from public.orcamentos where id=q;
 select snapshot_contratual into snap from public.contratos where id=antigo;
 begin
  update public.reservas set data_evento='2099-02-11' where id=r;
  raise exception 'Edição direta permitida';
 exception when check_violation then null; end;
 begin
  perform public.revisar_reserva_servidor(e,gen_random_uuid(),r,'{"revisao":1}');
  raise exception 'Usuário indevido permitiu revisão';
 exception when insufficient_privilege then null; end;
 select jsonb_agg(jsonb_build_object('estoque_item_id',i.estoque_item_id,'descricao',i.descricao,'quantidade',i.quantidade,'valor_unitario',case when i.valor_unitario>0 then 90 else i.valor_unitario end) order by ordem) into linhas from public.reserva_itens i where reserva_id=r;
 resultado:=public.revisar_reserva_servidor(e,u,r,jsonb_build_object('revisao',1,'data_evento','2099-02-11','itens',linhas));
 if resultado->>'contrato_cancelado_id'<>antigo::text then raise exception 'Contrato anterior não invalidado'; end if;
 if not exists(select 1 from public.contratos where id=antigo and status='Cancelado' and assinado_em is not null and snapshot_contratual=snap) then raise exception 'Histórico alterado'; end if;
 if not exists(select 1 from public.orcamentos where id=q and data_evento='2099-02-11' and total=159.98 and contrato_id is null and sinal_pago_em is not null and lancamento_sinal_id=ledger) then raise exception 'Orçamento não sincronizado'; end if;
 if not exists(select 1 from public.oportunidades where id=o and data_evento='2099-02-11' and valor_estimado=159.98) then raise exception 'Solicitação não sincronizada'; end if;
 if not exists(select 1 from public.reservas where id=r and status='Pendente' and valor_total=159.98 and revisao=2) then raise exception 'Reserva revisada incorreta'; end if;
 begin
  perform public.revisar_reserva_servidor(e,u,r,'{"revisao":1}');
  raise exception 'Versão obsoleta permitida';
 exception when serialization_failure then null; end;
 resultado:=public.revisar_reserva_servidor(e,u,r,'{"revisao":2}');
 if (resultado->>'alterado')::boolean then raise exception 'Reenvio sem alteração não idempotente'; end if;
 begin
  perform public.registrar_assinatura_publica_contrato((select public_token from public.contratos where id=antigo),'Teste transacional cadastro reserva','98765430001',null,'Teste rollback');
  raise exception 'Contrato cancelado assinável';
 exception when raise_exception then if sqlerrm='Contrato cancelado assinável' then raise; end if; end;
 resultado:=public.executar_formalizacao_servidor(u,q,'formalizar',50,'2099-02-09',null);
 novo:=(resultado->>'contrato_id')::uuid;
 if novo=antigo or not exists(select 1 from public.contratos where id=novo and numero_contrato like '%-R2' and assinado_em is null and snapshot_contratual->'reserva'->>'data_evento'='2099-02-11') then raise exception 'Nova versão incorreta'; end if;
 if resultado->>'lancamento_sinal_id'<>ledger::text or (select count(*) from public.lancamentos_financeiros where reserva_id=r and categoria='Sinal')<>1 then raise exception 'Cobrança duplicada'; end if;
 resultado:=public.registrar_assinatura_publica_contrato((select public_token from public.contratos where id=novo),'Teste transacional cadastro reserva','98765430001',null,'Teste rollback');
 if resultado->>'status'<>'RESERVA_CONFIRMADA' then raise exception 'Nova assinatura não aproveitou pagamento %',resultado; end if;
 repetido:=public.completar_cadastro_pre_reserva(e,token,dados);
 if not (repetido->>'ja_completo')::boolean then raise exception 'Reenvio após confirmação não idempotente'; end if;
 if has_function_privilege('anon','public.preparar_reserva_pre_reserva(uuid,uuid)','execute') or has_function_privilege('authenticated','public.preparar_reserva_pre_reserva(uuid,uuid)','execute') then raise exception 'Função exposta'; end if;
end $$;
rollback;
select 'PASS: revisão, sincronização, invalidação, snapshot, sinal preservado, nova assinatura; cadastro → reserva provisória → sinal escolhido → contrato → assinatura → pagamento → confirmação; totais, estoque, idempotência e permissões; rollback completo.' as resultado;
