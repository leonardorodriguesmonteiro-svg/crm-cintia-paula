-- Sprint Administracao 1.0: painel cadastral, fiscal e documental da empresa.

alter table public.empresas
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists cnpj text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists site text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists logo_url text,
  add column if not exists contrato_padrao text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.empresas
set nome_fantasia = coalesce(nullif(trim(nome_fantasia), ''), nome),
    razao_social = coalesce(nullif(trim(razao_social), ''), nome),
    contrato_padrao = coalesce(nullif(trim(contrato_padrao), ''),
      E'A reserva será confirmada somente após o pagamento do sinal combinado: 30% em dias comuns e 50% em finais de semana e feriados.\n\nA contratante se responsabiliza pela conservação dos itens locados até a devolução.\n\nEm caso de danos, perdas ou avarias, será cobrado o valor correspondente ao item.\n\nO cancelamento da reserva com menos de 7 dias da data do evento poderá implicar a perda do valor do sinal.\n\nA desmontagem e a devolução deverão ocorrer conforme combinado entre as partes.\n\nOs itens devem ser devolvidos limpos e nas mesmas condições em que foram entregues.\n\nO atraso na devolução poderá gerar cobrança de diária adicional.'
    );

create unique index if not exists empresas_cnpj_unique
on public.empresas (cnpj)
where cnpj is not null and cnpj <> '';

create or replace function public.atualizar_timestamp_empresa()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  new.nome := coalesce(nullif(trim(new.nome_fantasia), ''), nullif(trim(new.razao_social), ''), new.nome);
  return new;
end;
$$;

drop trigger if exists atualizar_timestamp_empresa on public.empresas;
create trigger atualizar_timestamp_empresa
before update on public.empresas
for each row execute function public.atualizar_timestamp_empresa();

create or replace function public.auditar_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.auditoria_logs (
    empresa_id,
    usuario_id,
    entidade,
    entidade_id,
    acao,
    dados_anteriores,
    dados_novos
  ) values (
    coalesce(new.id, old.id),
    auth.uid(),
    'empresas',
    coalesce(new.id, old.id)::text,
    case when tg_op = 'UPDATE' then 'Atualização' else tg_op end,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists auditar_empresa on public.empresas;
create trigger auditar_empresa
after update on public.empresas
for each row execute function public.auditar_empresa();

grant update on public.empresas to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos-empresa',
  'logos-empresa',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Logos da empresa sao publicos" on storage.objects;
create policy "Logos da empresa sao publicos"
on storage.objects for select
using (bucket_id = 'logos-empresa');

drop policy if exists "Administrador gerencia logo da empresa" on storage.objects;
create policy "Administrador gerencia logo da empresa"
on storage.objects for all to authenticated
using (
  bucket_id = 'logos-empresa'
  and public.usuario_eh_admin_empresa((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'logos-empresa'
  and public.usuario_eh_admin_empresa((storage.foldername(name))[1]::uuid)
);
