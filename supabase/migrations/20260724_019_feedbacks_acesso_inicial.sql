-- Inicializa com segurança o primeiro administrador da empresa e recupera
-- feedbacks enviados antes de os vínculos de usuários terem sido configurados.

create or replace function public.garantir_administrador_inicial()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_empresa_id uuid;
  v_total_empresas integer;
begin
  if v_usuario_id is null then
    return false;
  end if;

  if public.usuario_eh_administrador() then
    return true;
  end if;

  perform pg_advisory_xact_lock(hashtext('garantir_administrador_inicial'));

  if exists (
    select 1
    from public.usuarios_empresa
    where ativo = true
  ) then
    return false;
  end if;

  select count(*), min(id)
  into v_total_empresas, v_empresa_id
  from public.empresas;

  if v_total_empresas <> 1 or v_empresa_id is null then
    return false;
  end if;

  insert into public.usuarios_empresa (
    usuario_id,
    empresa_id,
    perfil,
    ativo
  ) values (
    v_usuario_id,
    v_empresa_id,
    'Administrador',
    true
  )
  on conflict (usuario_id, empresa_id) do update
  set
    perfil = 'Administrador',
    ativo = true;

  return true;
end;
$$;

revoke all on function public.garantir_administrador_inicial() from public;
grant execute on function public.garantir_administrador_inicial() to authenticated;

do $$
declare
  v_empresa_id uuid;
begin
  if (select count(*) from public.empresas) = 1 then
    select id into v_empresa_id from public.empresas limit 1;

    update public.feedbacks
    set
      empresa_id = v_empresa_id,
      updated_at = now()
    where empresa_id is null;
  end if;
end $$;
