-- Sprint Comercial 1.1 - Ajustes solicitados nos orcamentos.
-- Metadados de envio e cancelamento atomico com invalidacao do token publico.

alter table public.orcamentos
  add column if not exists email_enviado_em timestamptz,
  add column if not exists email_destino text,
  add column if not exists email_erro text;

create or replace function public.cancelar_envio_proposta_servidor(
  p_usuario_id uuid,
  p_empresa_id uuid,
  p_orcamento_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orcamento public.orcamentos%rowtype;
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Funcao exclusiva do servidor.';
  end if;

  if not exists (
    select 1 from public.usuarios_empresa vinculo
    where vinculo.usuario_id = p_usuario_id
      and vinculo.empresa_id = p_empresa_id
      and vinculo.ativo = true
      and vinculo.perfil in ('Administrador', 'Comercial')
  ) then
    raise exception using errcode = '42501', message = 'Usuario sem permissao comercial.';
  end if;

  select * into v_orcamento
  from public.orcamentos
  where id = p_orcamento_id and empresa_id = p_empresa_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Proposta nao encontrada.';
  end if;
  if v_orcamento.status in (
    'Aprovado', 'Recusado', 'ACEITA', 'RECUSADA', 'EXPIRADA', 'CANCELADA'
  ) or v_orcamento.resposta_cliente is not null then
    raise exception using errcode = '23514', message = 'Uma proposta respondida nao pode ter o envio cancelado.';
  end if;
  if v_orcamento.status not in ('Enviado', 'ENVIADA') then
    raise exception using errcode = '23514', message = 'Esta proposta nao possui um envio ativo.';
  end if;

  perform set_config('app.usuario_id', p_usuario_id::text, true);

  update public.orcamentos
  set
    public_token = gen_random_uuid(),
    status = case when status = 'ENVIADA' then 'RASCUNHO' else 'Rascunho' end,
    email_enviado_em = null,
    email_destino = null,
    email_erro = null,
    versao = versao + 1
  where id = v_orcamento.id;

  update public.oportunidades
  set etapa = 'APROVADA', versao = versao + 1
  where id = v_orcamento.oportunidade_id
    and empresa_id = p_empresa_id
    and etapa = 'CONVERTIDA_EM_PROPOSTA';

  return jsonb_build_object(
    'id', v_orcamento.id,
    'numero', v_orcamento.numero,
    'destino_anterior', v_orcamento.email_destino,
    'status', case when v_orcamento.status = 'ENVIADA' then 'RASCUNHO' else 'Rascunho' end
  );
end;
$$;

revoke all on function public.cancelar_envio_proposta_servidor(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.cancelar_envio_proposta_servidor(uuid, uuid, uuid)
to service_role;
