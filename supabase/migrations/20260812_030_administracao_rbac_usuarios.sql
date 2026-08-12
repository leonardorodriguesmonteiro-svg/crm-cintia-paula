-- Sprint Administracao 1.0: perfis, vinculo seguro, auditoria e acesso atual.

alter table public.usuarios_empresa
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create unique index if not exists usuarios_empresa_usuario_empresa_unique
on public.usuarios_empresa (usuario_id, empresa_id);

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.usuarios_empresa'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%perfil%'
  loop
    execute format('alter table public.usuarios_empresa drop constraint %I', v_constraint.conname);
  end loop;
end $$;

update public.usuarios_empresa
set perfil = 'Administrador'
where perfil is null
   or perfil not in ('Administrador', 'Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque');

update public.usuarios_empresa vinculo
set nome = coalesce(
  nullif(usuario.raw_user_meta_data ->> 'nome', ''),
  nullif(usuario.raw_user_meta_data ->> 'full_name', ''),
  split_part(coalesce(usuario.email, U&'Usu\00E1rio'), '@', 1)
)
from auth.users usuario
where usuario.id = vinculo.usuario_id
  and nullif(trim(vinculo.nome), '') is null;

alter table public.usuarios_empresa
  add constraint usuarios_empresa_perfil_check
  check (perfil in ('Administrador', 'Comercial', 'Financeiro', U&'Opera\00E7\00E3o', 'Estoque'));

-- Preserva o acesso que os usuarios do projeto ja possuiam antes do RBAC.
do $$
declare
  v_empresa_id uuid;
begin
  if (select count(*) from public.empresas) = 1 then
    select id into v_empresa_id from public.empresas limit 1;

    insert into public.usuarios_empresa (
      usuario_id,
      empresa_id,
      nome,
      perfil,
      ativo,
      updated_at
    )
    select
      usuario.id,
      v_empresa_id,
      coalesce(
        nullif(usuario.raw_user_meta_data ->> 'nome', ''),
        nullif(usuario.raw_user_meta_data ->> 'full_name', ''),
        split_part(coalesce(usuario.email, U&'Usu\00E1rio'), '@', 1)
      ),
      'Administrador',
      true,
      now()
    from auth.users usuario
    where not exists (
      select 1
      from public.usuarios_empresa vinculo
      where vinculo.usuario_id = usuario.id
        and vinculo.empresa_id = v_empresa_id
    );
  end if;
end $$;

create table if not exists public.auditoria_logs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  entidade text not null,
  entidade_id text,
  acao text not null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auditoria_logs_empresa_data_idx
on public.auditoria_logs (empresa_id, created_at desc);

create index if not exists auditoria_logs_usuario_idx
on public.auditoria_logs (usuario_id, created_at desc);

create or replace function public.usuario_pertence_empresa(p_empresa_id uuid)
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
      and vinculo.empresa_id = p_empresa_id
      and vinculo.ativo = true
  );
$$;

create or replace function public.usuario_eh_admin_empresa(p_empresa_id uuid)
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
      and vinculo.empresa_id = p_empresa_id
      and vinculo.ativo = true
      and vinculo.perfil = 'Administrador'
  );
$$;

create or replace function public.usuario_eh_administrador()
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
      and vinculo.perfil = 'Administrador'
  );
$$;

create or replace function public.usuario_tem_permissao(p_modulo text)
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
        or (vinculo.perfil = 'Comercial' and p_modulo = any(array[
          'dashboard', 'comercial', 'orcamentos', 'clientes', 'reservas',
          'agenda', 'contratos'
        ]))
        or (vinculo.perfil = 'Financeiro' and p_modulo = any(array[
          'dashboard', 'clientes', 'reservas', 'contratos', 'financeiro'
        ]))
        or (vinculo.perfil = U&'Opera\00E7\00E3o' and p_modulo = any(array[
          'dashboard', 'reservas', 'agenda', 'operacao', 'equipe', 'kits', 'estoque'
        ]))
        or (vinculo.perfil = 'Estoque' and p_modulo = any(array[
          'dashboard', 'reservas', 'kits', 'estoque'
        ]))
      )
  );
$$;

create or replace function public.meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'usuario_id', vinculo.usuario_id,
    'empresa_id', vinculo.empresa_id,
    'empresa_nome', empresa.nome,
    'nome', vinculo.nome,
    'perfil', vinculo.perfil,
    'ativo', vinculo.ativo,
    'permissoes', case vinculo.perfil
      when 'Administrador' then to_jsonb(array[
        'dashboard', 'comercial', 'orcamentos', 'clientes', 'reservas', 'agenda',
        'contratos', 'operacao', 'equipe', 'kits', 'estoque', 'financeiro',
        'feedbacks', 'usuarios', 'configuracoes', 'auditoria'
      ])
      when 'Comercial' then to_jsonb(array[
        'dashboard', 'comercial', 'orcamentos', 'clientes', 'reservas', 'agenda', 'contratos'
      ])
      when 'Financeiro' then to_jsonb(array[
        'dashboard', 'clientes', 'reservas', 'contratos', 'financeiro'
      ])
      when U&'Opera\00E7\00E3o' then to_jsonb(array[
        'dashboard', 'reservas', 'agenda', 'operacao', 'equipe', 'kits', 'estoque'
      ])
      when 'Estoque' then to_jsonb(array['dashboard', 'reservas', 'kits', 'estoque'])
      else '[]'::jsonb
    end
  )
  from public.usuarios_empresa vinculo
  join public.empresas empresa on empresa.id = vinculo.empresa_id
  where vinculo.usuario_id = auth.uid()
    and vinculo.ativo = true
  order by case when vinculo.perfil = 'Administrador' then 0 else 1 end, vinculo.created_at
  limit 1;
$$;

create or replace function public.atualizar_timestamp_usuario_empresa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists atualizar_timestamp_usuario_empresa on public.usuarios_empresa;
create trigger atualizar_timestamp_usuario_empresa
before update on public.usuarios_empresa
for each row execute function public.atualizar_timestamp_usuario_empresa();

create or replace function public.auditar_usuario_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.auditoria_logs (
      empresa_id, usuario_id, entidade, entidade_id, acao, dados_anteriores
    ) values (
      old.empresa_id,
      coalesce(old.updated_by, auth.uid()),
      'usuarios_empresa',
      old.id::text,
      'EXCLUIR',
      to_jsonb(old)
    );
    return old;
  end if;

  if tg_op = 'INSERT' then
    insert into public.auditoria_logs (
      empresa_id, usuario_id, entidade, entidade_id, acao, dados_novos
    ) values (
      new.empresa_id,
      coalesce(new.updated_by, auth.uid()),
      'usuarios_empresa',
      new.id::text,
      'CRIAR',
      to_jsonb(new)
    );
  else
    insert into public.auditoria_logs (
      empresa_id, usuario_id, entidade, entidade_id, acao,
      dados_anteriores, dados_novos
    ) values (
      new.empresa_id,
      coalesce(new.updated_by, auth.uid()),
      'usuarios_empresa',
      new.id::text,
      'ATUALIZAR',
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auditar_usuario_empresa on public.usuarios_empresa;
create trigger auditar_usuario_empresa
after insert or update or delete on public.usuarios_empresa
for each row execute function public.auditar_usuario_empresa();

alter table public.empresas enable row level security;
alter table public.usuarios_empresa enable row level security;
alter table public.auditoria_logs enable row level security;

do $$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('empresas', 'usuarios_empresa', 'auditoria_logs')
  loop
    execute format('drop policy if exists %I on %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
  end loop;
end $$;

create policy "Usuario visualiza sua empresa"
on public.empresas for select to authenticated
using (public.usuario_pertence_empresa(id));

create policy "Administrador atualiza sua empresa"
on public.empresas for update to authenticated
using (public.usuario_eh_admin_empresa(id))
with check (public.usuario_eh_admin_empresa(id));

create policy "Usuario visualiza proprio vinculo ou administrador visualiza equipe"
on public.usuarios_empresa for select to authenticated
using (
  usuario_id = auth.uid()
  or public.usuario_eh_admin_empresa(empresa_id)
);

create policy "Administrador gerencia vinculos"
on public.usuarios_empresa for all to authenticated
using (public.usuario_eh_admin_empresa(empresa_id))
with check (public.usuario_eh_admin_empresa(empresa_id));

create policy "Administrador visualiza auditoria"
on public.auditoria_logs for select to authenticated
using (public.usuario_eh_admin_empresa(empresa_id));

revoke all on function public.usuario_pertence_empresa(uuid) from public;
revoke all on function public.usuario_eh_admin_empresa(uuid) from public;
revoke all on function public.usuario_eh_administrador() from public;
revoke all on function public.usuario_tem_permissao(text) from public;
revoke all on function public.meu_acesso() from public;

grant execute on function public.usuario_pertence_empresa(uuid) to authenticated;
grant execute on function public.usuario_eh_admin_empresa(uuid) to authenticated;
grant execute on function public.usuario_eh_administrador() to authenticated;
grant execute on function public.usuario_tem_permissao(text) to authenticated;
grant execute on function public.meu_acesso() to authenticated;

grant select on public.empresas to authenticated;
grant select on public.usuarios_empresa to authenticated;
grant select on public.auditoria_logs to authenticated;
