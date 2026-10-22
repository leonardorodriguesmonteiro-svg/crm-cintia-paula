alter table public.oportunidades add column if not exists logistica_contrato jsonb not null default '{}'::jsonb;
alter table public.orcamentos add column if not exists logistica_contrato jsonb not null default '{}'::jsonb;
alter table public.reservas add column if not exists logistica_contrato jsonb not null default '{}'::jsonb;

create or replace function public.dia_atendimento_empresa(p_data date) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare ano integer; a integer;b integer;c integer;d integer;e integer;f integer;g integer;h integer;i integer;k integer;l integer;m integer;pascoa date; md text;
begin
 if p_data is null or extract(isodow from p_data)>5 then return false; end if;
 ano:=extract(year from p_data); md:=to_char(p_data,'MM-DD');
 if md=any(array['01-01','01-20','04-21','04-23','05-01','09-07','10-12','11-02','11-15','11-20','12-24','12-25','12-31']) then return false; end if;
 if md=(case when ano=2026 then '10-30' else '10-28' end) then return false; end if;
 if ano=2026 and md=any(array['04-20','04-24','06-05']) then return false; end if;
 a:=ano%19;b:=ano/100;c:=ano%100;d:=b/4;e:=b%4;f:=(b+8)/25;g:=(b-f+1)/3;h:=(19*a+b-d-g+15)%30;i:=c/4;k:=c%4;l:=(32+2*e+2*i-h-k)%7;m:=(a+11*h+22*l)/451;
 pascoa:=make_date(ano,(h+l-7*m+114)/31,(h+l-7*m+114)%31+1);
 return p_data<>all(array[pascoa-48,pascoa-47,pascoa-46,pascoa-2,pascoa+60]);
end; $$;
create or replace function public.proximo_dia_atendimento_empresa(p_data date) returns date
language sql immutable security invoker set search_path='' as $$
 select min(p_data+n) from generate_series(1,40) n where public.dia_atendimento_empresa(p_data+n);
$$;
create or replace function public.validar_logistica_contrato(p_data_evento date,p_dados jsonb,p_modalidade text default null,p_futuro boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare modalidade text:=coalesce(nullif(p_modalidade,''),p_dados->>'modalidade'); tipo text:=trim(p_dados->>'tipo_local_evento'); endereco text:=trim(p_dados->>'endereco_evento'); retirada date; devolucao date; hr text:=p_dados->>'horario_retirada'; hd text:=p_dados->>'horario_devolucao'; horarios text[]:=array['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']; loja text:='Rua Francisco Eugênio, 268 - Sala 948 - Imperial de São Cristovão, Rio de Janeiro - RJ - CEP 20941-120';
begin
 if p_data_evento is null then raise exception 'Peça à equipe para informar a data do evento.' using errcode='22023'; end if;
 if modalidade is null or modalidade not in ('Retirada','Entrega') then raise exception 'Informe a modalidade: Retirada ou Entrega.' using errcode='22023'; end if;
 if tipo is null or tipo not in ('Salão de festas','Residência') or coalesce(length(endereco),0) not between 10 and 600 then raise exception 'Informe o tipo de local e o endereço completo da festa.' using errcode='22023'; end if;
 if modalidade='Retirada' then
  if coalesce(p_dados->>'data_retirada','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Informe a data de retirada.' using errcode='22023'; end if;
  retirada:=(p_dados->>'data_retirada')::date;
  devolucao:=public.proximo_dia_atendimento_empresa(p_data_evento);
  if retirada>p_data_evento or not public.dia_atendimento_empresa(retirada) then raise exception 'A retirada deve ocorrer até a data do evento, em dia de atendimento, sem feriados ou pontos facultativos.' using errcode='22023'; end if;
  if hr is null or hd is null or not(hr=any(horarios)) or not(hd=any(horarios)) then raise exception 'Escolha os horários de retirada e devolução entre 09:00 e 12:00 ou 14:00 e 18:00, em intervalos de 30 minutos.' using errcode='22023'; end if;
  if p_futuro and retirada+hr::time < now() at time zone 'America/Sao_Paulo' then raise exception 'Escolha uma data e um horário de retirada futuros.' using errcode='22023'; end if;
 end if;
 return jsonb_build_object('modalidade',modalidade,'tipo_local_evento',tipo,'endereco_evento',endereco,'data_retirada',retirada,'horario_retirada',case when modalidade='Retirada' then hr end,'data_devolucao',devolucao,'horario_devolucao',case when modalidade='Retirada' then hd end,'endereco_retirada',case when modalidade='Retirada' then loja end,'endereco_devolucao',case when modalidade='Retirada' then loja end);
end; $$;
revoke all on function public.dia_atendimento_empresa(date), public.proximo_dia_atendimento_empresa(date), public.validar_logistica_contrato(date,jsonb,text,boolean) from public,anon;
grant execute on function public.dia_atendimento_empresa(date), public.proximo_dia_atendimento_empresa(date), public.validar_logistica_contrato(date,jsonb,text,boolean) to authenticated,service_role;

alter function public.completar_cadastro_pre_reserva(uuid,text,jsonb) rename to completar_cadastro_pre_reserva_base;
create function public.completar_cadastro_pre_reserva(p_empresa_id uuid,p_token_hash text,p_dados jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare o public.oportunidades%rowtype; q public.orcamentos%rowtype; v jsonb; resultado jsonb; modalidade text;
begin
 select op.* into o from public.oportunidades op join public.acompanhamento_links al on al.oportunidade_id=op.id
 where al.token_hash=p_token_hash and al.revoked_at is null and al.expires_at>now() and op.empresa_id=p_empresa_id for update of op;
 if not found then raise exception 'Link inválido ou expirado.' using errcode='22023'; end if;
 select * into q from public.orcamentos where oportunidade_id=o.id and empresa_id=p_empresa_id order by created_at desc limit 1 for update;
 if o.cadastro_completo_em is not null and o.logistica_contrato<>'{}'::jsonb then return jsonb_build_object('sucesso',true,'ja_completo',true); end if;
 if q.contrato_id is not null or (q.id is not null and q.formalizacao_status not in ('AGUARDANDO_DADOS','DADOS_COMPLETOS')) then raise exception 'Fale com a equipe para revisar os dados do contrato existente.' using errcode='22023'; end if;
 modalidade:=case when o.interesse ~* '(^|[|])[[:space:]]*Modalidade:[[:space:]]*Retirada([[:space:]]*[|]|[[:space:]]*$)' then 'Retirada' when o.interesse ~* '(^|[|])[[:space:]]*Modalidade:[[:space:]]*Entrega([[:space:]]*[|]|[[:space:]]*$)' then 'Entrega' end;
 v:=public.validar_logistica_contrato(o.data_evento,p_dados->'logistica_contrato',modalidade,true);
 if o.cadastro_completo_em is null then resultado:=public.completar_cadastro_pre_reserva_base(p_empresa_id,p_token_hash,p_dados); else resultado:=jsonb_build_object('sucesso',true,'ja_completo',false); end if;
 update public.oportunidades set logistica_contrato=v where id=o.id;
 update public.orcamentos set logistica_contrato=v,endereco_evento=v->>'endereco_evento',data_retirada=coalesce((v->>'data_retirada')::date,data_evento),horario_retirada=(v->>'horario_retirada')::time,data_devolucao=coalesce((v->>'data_devolucao')::date,data_evento),versao=versao+1 where oportunidade_id=o.id and empresa_id=p_empresa_id;
 update public.reservas rr set logistica_contrato=v,endereco_evento=v->>'endereco_evento',data_retirada=qq.data_retirada,horario_retirada=qq.horario_retirada,data_devolucao=qq.data_devolucao,revisao=revisao+1 from public.orcamentos qq where qq.oportunidade_id=o.id and qq.empresa_id=p_empresa_id and rr.id=qq.reserva_id;
 return resultado;
end; $$;
revoke all on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.completar_cadastro_pre_reserva(uuid,text,jsonb) to service_role;

create function public.completar_cadastro_proposta_agendado(p_token uuid,p_dados jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare q public.orcamentos%rowtype; v jsonb; resultado jsonb; interesse text; modalidade text;
begin
 select * into q from public.orcamentos where public_token=p_token for update;
 if not found then raise exception 'Proposta não encontrada.' using errcode='22023'; end if;
 if q.dados_cliente_completos_em is not null and q.logistica_contrato<>'{}'::jsonb then return jsonb_build_object('orcamento_id',q.id,'empresa_id',q.empresa_id,'numero',q.numero,'status',q.formalizacao_status,'ja_completo',true); end if;
 if q.status<>'ACEITA' or q.contrato_id is not null then raise exception 'A proposta precisa estar aceita e sem contrato emitido.' using errcode='22023'; end if;
 select o.interesse into interesse from public.oportunidades o where o.id=q.oportunidade_id and o.empresa_id=q.empresa_id;
 modalidade:=case when interesse ~* '(^|[|])[[:space:]]*Modalidade:[[:space:]]*Retirada([[:space:]]*[|]|[[:space:]]*$)' then 'Retirada' when interesse ~* '(^|[|])[[:space:]]*Modalidade:[[:space:]]*Entrega([[:space:]]*[|]|[[:space:]]*$)' then 'Entrega' end;
 v:=public.validar_logistica_contrato(q.data_evento,p_dados->'logistica_contrato',modalidade,true);
 resultado:=public.completar_dados_cliente_proposta_v2_servidor(p_token,p_dados->>'cpf',p_dados->>'cep',p_dados->>'endereco',p_dados->>'numero',p_dados->>'complemento',p_dados->>'bairro',p_dados->>'cidade',p_dados->>'estado',p_dados->>'email');
 update public.orcamentos set logistica_contrato=v,endereco_evento=v->>'endereco_evento',data_retirada=coalesce((v->>'data_retirada')::date,data_evento),horario_retirada=(v->>'horario_retirada')::time,data_devolucao=coalesce((v->>'data_devolucao')::date,data_evento),versao=versao+1 where id=q.id;
 update public.oportunidades set logistica_contrato=v where id=q.oportunidade_id and empresa_id=q.empresa_id;
 update public.reservas rr set logistica_contrato=v,endereco_evento=v->>'endereco_evento',data_retirada=qq.data_retirada,horario_retirada=qq.horario_retirada,data_devolucao=qq.data_devolucao,revisao=rr.revisao+1 from public.orcamentos qq where qq.id=q.id and rr.id=qq.reserva_id;
 return resultado||jsonb_build_object('ja_completo',false);
end; $$;
revoke all on function public.completar_cadastro_proposta_agendado(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.completar_cadastro_proposta_agendado(uuid,jsonb) to service_role;

create function public.propagar_logistica_reserva() returns trigger language plpgsql security invoker set search_path='' as $$
declare v jsonb;
begin
 select logistica_contrato into v from public.orcamentos where id=new.orcamento_id;
 if v is not null and v<>'{}'::jsonb then new.logistica_contrato:=v;new.endereco_evento:=v->>'endereco_evento'; end if;
 return new;
end; $$;
revoke all on function public.propagar_logistica_reserva() from public,anon,authenticated;
create trigger propagar_logistica_reserva before insert on public.reservas for each row execute function public.propagar_logistica_reserva();
create function public.validar_logistica_emissao_contrato() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.reservas%rowtype; v jsonb;
begin
 select * into r from public.reservas where id=new.reserva_id;
 v:=public.validar_logistica_contrato(r.data_evento,r.logistica_contrato);
 if r.endereco_evento is distinct from v->>'endereco_evento' or (v->>'modalidade'='Retirada' and (r.data_retirada is distinct from (v->>'data_retirada')::date or r.data_devolucao is distinct from (v->>'data_devolucao')::date or r.horario_retirada is distinct from (v->>'horario_retirada')::time)) then raise exception 'Confira os dados de local e agendamento na reserva antes de emitir o contrato.' using errcode='22023'; end if;
 return new;
end; $$;
revoke all on function public.validar_logistica_emissao_contrato() from public,anon,authenticated;
create trigger a_validar_logistica_emissao before insert on public.contratos for each row execute function public.validar_logistica_emissao_contrato();
create or replace function public.revisar_reserva_servidor(p_empresa_id uuid,p_usuario_id uuid,p_reserva_id uuid,p_dados jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<revisar_reserva_servidor>>
declare
 r public.reservas%rowtype; q public.orcamentos%rowtype; l public.lancamentos_financeiros%rowtype;
 v_logistica jsonb; itens jsonb; anteriores jsonb; item record; total numeric; desconto numeric; subtotal numeric;
 data_evento date; horario text; endereco text; cliente uuid; sinal numeric; cancelado uuid; alterado boolean;
begin
 if not exists(select 1 from public.usuarios_empresa where empresa_id=p_empresa_id and usuario_id=p_usuario_id and ativo and perfil in ('Administrador','Comercial')) then raise exception 'Sem permissão para editar a reserva.' using errcode='42501'; end if;
 -- A mesma ordem de bloqueio usada pela formalização evita corrida com assinatura/pagamento.
 select * into q from public.orcamentos where reserva_id=p_reserva_id and empresa_id=p_empresa_id for update;
 if not found then raise exception 'Orçamento vinculado não encontrado.' using errcode='P0002'; end if;
 select * into r from public.reservas where id=p_reserva_id and orcamento_id=q.id for update;
 if not found then raise exception 'Reserva não encontrada.' using errcode='P0002'; end if;
 if (p_dados->>'revisao')::integer is distinct from r.revisao then raise exception 'A reserva foi alterada. Atualize a página antes de salvar.' using errcode='40001'; end if;
 if r.status in ('Cancelada','Concluída','Em andamento') then raise exception 'Esta reserva não permite revisão contratual nesta etapa.' using errcode='22023'; end if;
 data_evento:=coalesce((p_dados->>'data_evento')::date,r.data_evento);
 horario:=case when p_dados ? 'horario_evento' then nullif(trim(p_dados->>'horario_evento'),'') else r.horario_evento end;
 endereco:=case when p_dados ? 'endereco_evento' then nullif(trim(p_dados->>'endereco_evento'),'') else r.endereco_evento end;
 cliente:=coalesce((p_dados->>'cliente_id')::uuid,r.cliente_id);
 if cliente is distinct from r.cliente_id then raise exception 'A troca de cliente exige uma nova solicitação.' using errcode='22023'; end if;
 v_logistica:=public.validar_logistica_contrato(data_evento,coalesce(p_dados->'logistica_contrato',r.logistica_contrato)||jsonb_build_object('endereco_evento',endereco));
 sinal:=coalesce((p_dados->>'valor_sinal')::numeric,r.valor_sinal,0);
 select coalesce(jsonb_agg(jsonb_build_object('kit_id',i.kit_id,'estoque_item_id',i.estoque_item_id,'kit_composicao_id',i.kit_composicao_id,'descricao',i.descricao,'quantidade',i.quantidade,'valor_unitario',i.valor_unitario) order by i.ordem,i.created_at,i.id),'[]'::jsonb) into anteriores from public.reserva_itens i where i.reserva_id=r.id;
 itens:=coalesce(p_dados->'itens',anteriores);
 if jsonb_typeof(itens)<>'array' or jsonb_array_length(itens) not between 1 and 100 then raise exception 'Informe de 1 a 100 itens.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_to_recordset(itens) x(descricao text,quantidade numeric,valor_unitario numeric,kit_id uuid,estoque_item_id uuid) where length(trim(coalesce(x.descricao,''))) not between 2 and 300 or x.quantidade is null or x.quantidade<=0 or x.quantidade<>round(x.quantidade,2) or x.valor_unitario is null or x.valor_unitario<>round(x.valor_unitario,2) or (x.kit_id is not null and (x.quantidade<>1 or x.estoque_item_id is not null)) or (x.valor_unitario<0 and (x.kit_id is not null or x.estoque_item_id is not null))) then raise exception 'Itens ou valores inválidos.' using errcode='22023'; end if;
 -- Normalização torna salvar sem alterações idempotente, independentemente da representação numérica.
 select jsonb_agg(jsonb_build_object('kit_id',x.kit_id,'estoque_item_id',x.estoque_item_id,'kit_composicao_id',x.kit_composicao_id,'descricao',trim(x.descricao),'quantidade',x.quantidade,'valor_unitario',x.valor_unitario)) into itens from jsonb_to_recordset(itens) x(kit_id uuid,estoque_item_id uuid,kit_composicao_id uuid,descricao text,quantidade numeric,valor_unitario numeric);
 select sum(round(x.quantidade*x.valor_unitario,2)),sum(greatest(round(x.quantidade*x.valor_unitario,2),0)),sum(greatest(-round(x.quantidade*x.valor_unitario,2),0)) into total,subtotal,desconto from jsonb_to_recordset(itens) x(quantidade numeric,valor_unitario numeric);
 if total<=0 or sinal<0 or sinal>total then raise exception 'Confira o total e o valor do sinal.' using errcode='22023'; end if;
 select * into l from public.lancamentos_financeiros where id=q.lancamento_sinal_id for update;
 if l.status='Pago' and sinal is distinct from l.valor then raise exception 'O sinal já recebido deve ser preservado. Ajustes financeiros são realizados no Financeiro.' using errcode='22023'; end if;
 alterado:=v_logistica is distinct from r.logistica_contrato or data_evento is distinct from r.data_evento or horario is distinct from r.horario_evento or endereco is distinct from r.endereco_evento or sinal is distinct from r.valor_sinal or itens<>anteriores or q.data_evento is distinct from data_evento or q.total is distinct from total;
 if not alterado then
 update public.reservas set observacoes=case when p_dados ? 'observacoes' then p_dados->>'observacoes' else r.observacoes end where id=r.id;
 return jsonb_build_object('alterado',false,'reserva_id',r.id,'revisao',r.revisao); end if;
 perform set_config('app.revisao_reserva',r.id::text,true);
 perform set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 perform set_config('app.usuario_id',p_usuario_id::text,true);
 cancelado:=q.contrato_id;
 if cancelado is not null then
  update public.contratos set status='Cancelado',cancelado_em=now(),motivo_cancelamento='Reserva revisada: a versão anterior foi substituída e não deve ser utilizada.' where id=cancelado and status<>'Cancelado';
 end if;
 update public.orcamentos set contrato_id=null,contrato_assinado_em=null,formalizado_em=null,formalizacao_status='DADOS_COMPLETOS',formalizacao_bloqueio=null,hold_expira_em=null where id=q.id;
 update public.reservas set logistica_contrato=v_logistica,status='Pendente',status_comercial='Aguardando contrato',status_operacional='Aguardando confirmação',data_evento=revisar_reserva_servidor.data_evento,
 data_retirada=coalesce((v_logistica->>'data_retirada')::date,revisar_reserva_servidor.data_evento),
 data_devolucao=coalesce((v_logistica->>'data_devolucao')::date,revisar_reserva_servidor.data_evento),
 horario_retirada=(v_logistica->>'horario_retirada')::time,horario_evento=horario,endereco_evento=endereco,valor_sinal=sinal,revisao=r.revisao+1,
 observacoes=case when p_dados ? 'observacoes' then p_dados->>'observacoes' else r.observacoes end where id=r.id;
 delete from public.reserva_itens where reserva_id=r.id;
 insert into public.reserva_itens(reserva_id,kit_id,estoque_item_id,kit_composicao_id,descricao,quantidade,valor_unitario,ordem)
 select r.id,x.kit_id,x.estoque_item_id,x.kit_composicao_id,x.descricao,x.quantidade,x.valor_unitario,(row_number() over())::integer from jsonb_to_recordset(itens) x(kit_id uuid,estoque_item_id uuid,kit_composicao_id uuid,descricao text,quantidade numeric,valor_unitario numeric);
 update public.reservas set valor_total=total,kit_id=(select i.kit_id from public.reserva_itens i where i.reserva_id=r.id and i.kit_id is not null order by i.ordem limit 1) where id=r.id;
 delete from public.orcamento_taxas where orcamento_id=q.id;
 delete from public.orcamento_itens where orcamento_id=q.id;
 insert into public.orcamento_itens(orcamento_id,kit_id,estoque_item_id,tipo_origem,descricao,quantidade,valor_unitario,preco_base,preco_unitario_orcamento,ordem)
 select q.id,i.kit_id,i.estoque_item_id,case when i.kit_id is not null then 'KIT' when i.estoque_item_id is not null then 'ESTOQUE' else 'LIVRE' end,i.descricao,i.quantidade,i.valor_unitario,i.valor_unitario,i.valor_unitario,i.ordem from public.reserva_itens i where i.reserva_id=r.id and i.valor_unitario>=0;
 update public.orcamentos set logistica_contrato=v_logistica,horario_retirada=(v_logistica->>'horario_retirada')::time,data_evento=revisar_reserva_servidor.data_evento,data_retirada=nr.data_retirada,data_devolucao=nr.data_devolucao,horario_evento=horario,endereco_evento=endereco,subtotal=revisar_reserva_servidor.subtotal,desconto_tipo='VALOR',desconto_valor=revisar_reserva_servidor.desconto,acrescimos=0,frete=0,total_taxas=0,versao=q.versao+1,valor_sinal_formalizacao=nullif(sinal,0) from public.reservas nr where public.orcamentos.id=q.id and nr.id=r.id;
 update public.oportunidades set logistica_contrato=v_logistica,data_evento=revisar_reserva_servidor.data_evento,valor_estimado=total,updated_at=now(),versao=versao+1 where id=q.oportunidade_id and empresa_id=p_empresa_id;
 insert into public.reserva_timeline(reserva_id,titulo,descricao,tipo) values(r.id,'Reserva revisada','Datas e valores sincronizados. Contrato anterior substituído; nova assinatura necessária. Pagamentos preservados.','Contrato');
 return jsonb_build_object('alterado',true,'reserva_id',r.id,'revisao',r.revisao+1,'contrato_cancelado_id',cancelado,'sinal_pago_preservado',l.status='Pago');
end; $$;
revoke all on function public.revisar_reserva_servidor(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.revisar_reserva_servidor(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.proteger_reserva_contratada() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 if tg_table_name='reservas' then v_id:=old.id; elsif tg_op='INSERT' then v_id:=new.reserva_id; else v_id:=old.reserva_id; end if;
 if current_setting('app.revisao_reserva',true) is not distinct from v_id::text then return case when tg_op='DELETE' then old else new end; end if;
 if tg_table_name='reservas' then
 if row(new.logistica_contrato,new.data_evento,new.horario_evento,new.endereco_evento,new.cliente_id,new.valor_sinal,new.valor_total,new.data_retirada,new.data_devolucao,new.horario_retirada) is not distinct from row(old.logistica_contrato,old.data_evento,old.horario_evento,old.endereco_evento,old.cliente_id,old.valor_sinal,old.valor_total,old.data_retirada,old.data_devolucao,old.horario_retirada) then return new; end if;
 end if;
 if exists(select 1 from public.contratos where reserva_id=v_id and status in ('Gerado','Enviado','Assinado')) then
  raise exception 'Use a edição de reserva para revisar o contrato e avisar o cliente.' using errcode='23514';
 end if;
 return case when tg_op='DELETE' then old else new end;
end; $$;
revoke all on function public.proteger_reserva_contratada() from public,anon,authenticated;
