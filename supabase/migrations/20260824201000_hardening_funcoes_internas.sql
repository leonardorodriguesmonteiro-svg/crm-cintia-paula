-- Funções internas e helpers autenticados não devem ser expostos ao papel
-- anônimo pela Data API. Funções de trigger continuam funcionando sem EXECUTE
-- concedido aos clientes da API.

revoke execute on function public.auditar_empresa() from public, anon;
revoke execute on function public.auditar_entidade_operacional() from public, anon;
revoke execute on function public.auditar_evidence_engine() from public, anon;
revoke execute on function public.auditar_usuario_empresa() from public, anon;
revoke execute on function public.garantir_administrador_inicial() from public, anon;
revoke execute on function public.gerar_codigo_automatico_estoque() from public, anon;
revoke execute on function public.meu_acesso() from public, anon;
revoke execute on function public.recalcular_orcamento_por_itens() from public, anon;
revoke execute on function public.recalcular_reserva_por_itens() from public, anon;
revoke execute on function public.registrar_preferencia_mercado_pago(uuid, text, text) from public, anon;
revoke execute on function public.registrar_timeline_assinatura_missao() from public, anon;
revoke execute on function public.registrar_timeline_evidencia_missao() from public, anon;
revoke execute on function public.registrar_timeline_ocorrencia_missao() from public, anon;
revoke execute on function public.usuario_eh_admin_empresa(uuid) from public, anon;
revoke execute on function public.usuario_eh_administrador() from public, anon;
revoke execute on function public.usuario_pertence_empresa(uuid) from public, anon;
revoke execute on function public.usuario_tem_perfil(text[]) from public, anon;
revoke execute on function public.usuario_tem_permissao(text) from public, anon;

alter function public.registrar_timeline_reserva_criada() set search_path = public;
alter function public.registrar_timeline_reserva_editada() set search_path = public;
alter function public.registrar_timeline_recebimento() set search_path = public;
alter function public.bloquear_reserva_duplicada_kit_data() set search_path = public;
