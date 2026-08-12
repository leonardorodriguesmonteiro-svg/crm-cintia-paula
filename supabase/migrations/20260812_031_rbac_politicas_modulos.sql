-- Sprint Administracao 1.0: RBAC efetivo nas tabelas operacionais.
-- Administradores sempre possuem acesso; os demais perfis recebem apenas
-- as leituras e mutacoes necessarias ao seu modulo.

create or replace function public.usuario_tem_perfil(p_perfis text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_empresa vinculo
    where vinculo.usuario_id = auth.uid()
      and vinculo.ativo = true
      and (
        vinculo.perfil = 'Administrador'
        or vinculo.perfil = any(coalesce(p_perfis, array[]::text[]))
      )
  );
$$;

revoke all on function public.usuario_tem_perfil(text[]) from public;
grant execute on function public.usuario_tem_perfil(text[]) to authenticated;

-- Remove apenas as politicas das tabelas operacionais que passam a ser
-- administradas por esta matriz. As politicas de empresas, usuarios,
-- feedbacks e auditoria permanecem independentes.
do $$
declare
  v_politica record;
begin
  for v_politica in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'clientes', 'kits', 'kit_composicao', 'kit_itens', 'estoque_itens',
        'estoque', 'movimentos_estoque', 'temas', 'oportunidades',
        'oportunidade_historico', 'orcamentos', 'orcamento_itens', 'reservas',
        'reserva_itens', 'reserva_timeline', 'recebimentos', 'contratos',
        'modelos_contrato', 'clausulas_contrato', 'modelo_clausulas',
        'contrato_versoes', 'ordens_servico', 'ordem_servico_itens',
        'reserva_logistica', 'timeline_global', 'workflow_acoes',
        'workflow_eventos', 'workflow_regras', 'equipe', 'ordem_servico_equipe',
        'reserva_checklist', 'conferencias', 'conferencia_itens',
        'lancamentos_financeiros', 'despesas', 'pagamentos',
        'pagamento_webhook_eventos', 'configuracoes_pagamento'
      ])
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      v_politica.policyname,
      v_politica.tablename
    );
  end loop;
end $$;

-- Cadastros de consulta compartilhada.
create policy rbac_clientes_consultar on public.clientes
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_clientes_gerenciar on public.clientes
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_kits_consultar on public.kits
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_kits_gerenciar on public.kits
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_kit_composicao_consultar on public.kit_composicao
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_kit_composicao_gerenciar on public.kit_composicao
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_kit_itens_consultar on public.kit_itens
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_kit_itens_gerenciar on public.kit_itens
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_estoque_itens_consultar on public.estoque_itens
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_estoque_itens_gerenciar on public.estoque_itens
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_estoque_consultar on public.estoque
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_estoque_gerenciar on public.estoque
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_movimentos_estoque_consultar on public.movimentos_estoque
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_movimentos_estoque_gerenciar on public.movimentos_estoque
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_temas_consultar on public.temas
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_temas_gerenciar on public.temas
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

-- Comercial.
create policy rbac_oportunidades_comercial on public.oportunidades
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_oportunidade_historico_comercial on public.oportunidade_historico
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_orcamentos_comercial on public.orcamentos
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_orcamento_itens_comercial on public.orcamento_itens
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

-- Reservas e dados compartilhados entre os modulos.
create policy rbac_reservas_consultar on public.reservas
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_reservas_criar on public.reservas
for insert to authenticated
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_reservas_atualizar on public.reservas
for update to authenticated
using (public.usuario_tem_perfil(array['Comercial', U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array['Comercial', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_reservas_excluir on public.reservas
for delete to authenticated
using (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_reserva_itens_consultar on public.reserva_itens
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_reserva_itens_gerenciar on public.reserva_itens
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_reserva_timeline_consultar on public.reserva_timeline
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_reserva_timeline_registrar on public.reserva_timeline
for insert to authenticated
with check (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_reserva_timeline_administrar on public.reserva_timeline
for update to authenticated
using (public.usuario_tem_perfil(array[]::text[]))
with check (public.usuario_tem_perfil(array[]::text[]));

create policy rbac_reserva_timeline_excluir on public.reserva_timeline
for delete to authenticated
using (public.usuario_tem_perfil(array[]::text[]));

create policy rbac_recebimentos_consultar on public.recebimentos
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_recebimentos_gerenciar on public.recebimentos
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro']))
with check (public.usuario_tem_perfil(array['Comercial', 'Financeiro']));

create policy rbac_contratos_consultar on public.contratos
for select to authenticated
using (public.usuario_tem_perfil(array['Comercial', 'Financeiro']));

create policy rbac_contratos_gerenciar on public.contratos
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_modelos_contrato_comercial on public.modelos_contrato
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_clausulas_contrato_comercial on public.clausulas_contrato
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_modelo_clausulas_comercial on public.modelo_clausulas
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

create policy rbac_contrato_versoes_comercial on public.contrato_versoes
for all to authenticated
using (public.usuario_tem_perfil(array['Comercial']))
with check (public.usuario_tem_perfil(array['Comercial']));

-- Operacao.
create policy rbac_ordens_servico_operacao on public.ordens_servico
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_ordem_servico_itens_operacao on public.ordem_servico_itens
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_reserva_logistica_operacao on public.reserva_logistica
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_timeline_global_operacao on public.timeline_global
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_workflow_acoes_operacao on public.workflow_acoes
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_workflow_eventos_operacao on public.workflow_eventos
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_workflow_regras_operacao on public.workflow_regras
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_equipe_operacao on public.equipe
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_ordem_servico_equipe_operacao on public.ordem_servico_equipe
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o']));

create policy rbac_reserva_checklist_operacao_estoque on public.reserva_checklist
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_conferencias_operacao_estoque on public.conferencias
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

create policy rbac_conferencia_itens_operacao_estoque on public.conferencia_itens
for all to authenticated
using (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']))
with check (public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque']));

-- Financeiro.
create policy rbac_lancamentos_financeiros on public.lancamentos_financeiros
for all to authenticated
using (public.usuario_tem_perfil(array['Financeiro']))
with check (public.usuario_tem_perfil(array['Financeiro']));

create policy rbac_despesas on public.despesas
for all to authenticated
using (public.usuario_tem_perfil(array['Financeiro']))
with check (public.usuario_tem_perfil(array['Financeiro']));

create policy rbac_pagamentos on public.pagamentos
for all to authenticated
using (public.usuario_tem_perfil(array['Financeiro']))
with check (public.usuario_tem_perfil(array['Financeiro']));

create policy rbac_pagamento_webhook_eventos_consultar on public.pagamento_webhook_eventos
for select to authenticated
using (public.usuario_tem_perfil(array['Financeiro']));

create policy rbac_configuracoes_pagamento_admin on public.configuracoes_pagamento
for all to authenticated
using (public.usuario_tem_perfil(array[]::text[]))
with check (public.usuario_tem_perfil(array[]::text[]));

-- RPCs internos passam a respeitar as politicas acima.
alter function public.salvar_reserva_com_itens(uuid, uuid, date, text, text, numeric, text, text, jsonb)
security invoker;

alter function public.aprovar_orcamento_e_criar_reserva(uuid)
security invoker;

alter function public.registrar_conferencia(uuid, text, text, text, jsonb)
security invoker;

alter function public.composicao_reserva(uuid)
security invoker;

grant execute on function public.composicao_reserva(uuid) to authenticated;

-- A formalizacao cruza Comercial e Financeiro e, por isso, permanece elevada,
-- mas deixa de ser executavel diretamente pelo navegador. As rotas do servidor
-- validam o perfil antes de usar a service role.
revoke execute on function public.formalizar_orcamento_aprovado(uuid, numeric, date) from authenticated;
revoke execute on function public.confirmar_assinatura_formalizacao(uuid) from authenticated;
revoke execute on function public.confirmar_pagamento_sinal_formalizacao(uuid, text) from authenticated;

grant execute on function public.formalizar_orcamento_aprovado(uuid, numeric, date) to service_role;
grant execute on function public.confirmar_assinatura_formalizacao(uuid) to service_role;
grant execute on function public.confirmar_pagamento_sinal_formalizacao(uuid, text) to service_role;

-- O bootstrap do primeiro administrador ja foi concluido neste projeto.
-- Retirar a execucao do cliente elimina uma superficie de escalada futura.
revoke execute on function public.garantir_administrador_inicial() from authenticated;
