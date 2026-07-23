create or replace function public.usuario_eh_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_empresa ue
    where ue.usuario_id = auth.uid()
      and ue.ativo = true
      and ue.perfil = 'Administrador'
  );
$$;

revoke all on function public.usuario_eh_administrador() from public;
grant execute on function public.usuario_eh_administrador() to authenticated;

drop policy if exists "Administrador pode visualizar todos os feedbacks"
on public.feedbacks;

create policy "Administrador pode visualizar todos os feedbacks"
on public.feedbacks
for select
to authenticated
using (
  public.usuario_eh_administrador()
);

drop policy if exists "Administrador pode atualizar feedbacks"
on public.feedbacks;

create policy "Administrador pode atualizar feedbacks"
on public.feedbacks
for update
to authenticated
using (
  public.usuario_eh_administrador()
)
with check (
  public.usuario_eh_administrador()
);
