begin;
do $$
declare
 e uuid; u uuid; k uuid; o uuid; q uuid; r uuid; c uuid; resultado jsonb; repetido jsonb;
 token text:=encode(gen_random_bytes(32),'hex'); dados jsonb;
 estoque_antes numeric; total_antes bigint;
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
 dados:=dados||jsonb_build_object('logistica_contrato','{"modalidade": "Retirada", "tipo_local_evento": "Salão de festas", "endereco_evento": "Rua do Evento, 100, Centro, Rio de Janeiro - RJ", "data_retirada": "2099-02-09", "horario_retirada": "10:00", "horario_devolucao": "14:00"}'::jsonb);
 begin
  perform public.completar_cadastro_pre_reserva(e,token,dados-'logistica_contrato');
  raise exception 'Cadastro sem local permitido';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.completar_cadastro_pre_reserva(e,token,jsonb_set(dados,'{logistica_contrato,horario_retirada}','"13:00"'));
  raise exception 'Retirada durante intervalo permitida';
 exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.orcamentos where oportunidade_id=o) then raise exception 'Cadastro inválido persistiu parcialmente'; end if;
 resultado:=public.completar_cadastro_pre_reserva(e,token,dados);
 select id,reserva_id,cliente_id into q,r,c from public.orcamentos where oportunidade_id=o;
 if not exists(select 1 from public.reservas rr join public.orcamentos qq on qq.id=rr.orcamento_id where rr.id=r and rr.logistica_contrato=qq.logistica_contrato and rr.logistica_contrato->>'endereco_evento'='Rua do Evento, 100, Centro, Rio de Janeiro - RJ' and rr.data_devolucao=public.proximo_dia_atendimento_empresa(rr.data_evento)) then raise exception 'Logística não sincronizada'; end if;
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
 if (select snapshot_contratual->'reserva'->'logistica_contrato' from public.contratos where id=(resultado->>'contrato_id')::uuid) is distinct from (select logistica_contrato from public.reservas where id=r) then raise exception 'Logística ausente no snapshot do contrato'; end if;
 repetido:=public.executar_formalizacao_servidor(u,q,'formalizar',90,'2099-02-08',null);
 if repetido->>'contrato_id'<>resultado->>'contrato_id' or not (repetido->>'ja_formalizada')::boolean then raise exception 'Contrato duplicado'; end if;
 if not exists(select 1 from public.lancamentos_financeiros where id=(resultado->>'lancamento_sinal_id')::uuid and valor=50 and data_vencimento='2099-02-09') then raise exception 'Condições do sinal alteradas'; end if;
 resultado:=public.registrar_assinatura_publica_contrato((select public_token from public.contratos where id=(resultado->>'contrato_id')::uuid),'Teste transacional cadastro reserva','98765430001',null,'Teste rollback');
 if resultado->>'status'<>'AGUARDANDO_PAGAMENTO' then raise exception 'Assinatura confirmou sem pagamento'; end if;
 resultado:=public.executar_formalizacao_servidor(u,q,'confirmar_sinal',null,null,'Pix');
 if resultado->>'status'<>'RESERVA_CONFIRMADA' then raise exception 'Reserva não confirmou %',resultado; end if;
 if public.quantidade_estoque_comprometida(k,'2099-02-10','2099-02-10',null)<>estoque_antes+2 then raise exception 'Estoque confirmado incorreto'; end if;
 repetido:=public.completar_cadastro_pre_reserva(e,token,dados);
 if not (repetido->>'ja_completo')::boolean then raise exception 'Reenvio após confirmação não idempotente'; end if;
 if has_function_privilege('anon','public.preparar_reserva_pre_reserva(uuid,uuid)','execute') or has_function_privilege('authenticated','public.preparar_reserva_pre_reserva(uuid,uuid)','execute') then raise exception 'Função exposta'; end if;
end $$;
rollback;
select 'PASS: cadastro → reserva provisória → sinal escolhido → contrato → assinatura → pagamento → confirmação; totais, estoque, idempotência e permissões; rollback completo.' as resultado;
