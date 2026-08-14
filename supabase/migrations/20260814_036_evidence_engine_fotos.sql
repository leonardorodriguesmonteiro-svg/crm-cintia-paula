-- Sprint 2.0 - Evidence Engine: fundacao e fotos operacionais da missao.

create table if not exists public.evidencias_missao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  ordem_servico_id uuid not null references public.ordens_servico(id) on delete cascade,
  tipo text not null default 'foto',
  etapa text not null,
  titulo text,
  descricao text,
  storage_path text not null unique,
  mime_type text not null,
  tamanho_bytes bigint not null default 0,
  capturada_em timestamptz not null default now(),
  criada_por uuid references auth.users(id) on delete set null,
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidencias_missao_tipo_check check (tipo = 'foto'),
  constraint evidencias_missao_etapa_check check (etapa = any(array[
    'preparacao', 'entrega', 'evento', 'retirada', 'devolucao'
  ])),
  constraint evidencias_missao_tamanho_check check (tamanho_bytes >= 0)
);

create index if not exists evidencias_missao_reserva_data_idx
on public.evidencias_missao (reserva_id, capturada_em desc);

create index if not exists evidencias_missao_ordem_etapa_idx
on public.evidencias_missao (ordem_servico_id, etapa, capturada_em desc);

alter table public.evidencias_missao enable row level security;

drop policy if exists "Equipe visualiza evidencias da empresa" on public.evidencias_missao;
create policy "Equipe visualiza evidencias da empresa"
on public.evidencias_missao for select to authenticated
using (public.usuario_pertence_empresa(empresa_id));

drop policy if exists "Operacao registra evidencias da missao" on public.evidencias_missao;
create policy "Operacao registra evidencias da missao"
on public.evidencias_missao for insert to authenticated
with check (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
  and criada_por = auth.uid()
);

drop policy if exists "Operacao atualiza evidencias da missao" on public.evidencias_missao;
create policy "Operacao atualiza evidencias da missao"
on public.evidencias_missao for update to authenticated
using (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
)
with check (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

drop policy if exists "Operacao remove evidencias da missao" on public.evidencias_missao;
create policy "Operacao remove evidencias da missao"
on public.evidencias_missao for delete to authenticated
using (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

grant select, insert, update, delete on public.evidencias_missao to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidencias-missao',
  'evidencias-missao',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Equipe visualiza arquivos de evidencia" on storage.objects;
create policy "Equipe visualiza arquivos de evidencia"
on storage.objects for select to authenticated
using (
  bucket_id = 'evidencias-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Operacao envia arquivos de evidencia" on storage.objects;
create policy "Operacao envia arquivos de evidencia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'evidencias-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

drop policy if exists "Operacao atualiza arquivos de evidencia" on storage.objects;
create policy "Operacao atualiza arquivos de evidencia"
on storage.objects for update to authenticated
using (
  bucket_id = 'evidencias-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
)
with check (
  bucket_id = 'evidencias-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

drop policy if exists "Operacao remove arquivos de evidencia" on storage.objects;
create policy "Operacao remove arquivos de evidencia"
on storage.objects for delete to authenticated
using (
  bucket_id = 'evidencias-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

create or replace function public.registrar_timeline_evidencia_missao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa text;
begin
  v_etapa := case new.etapa
    when 'preparacao' then U&'Prepara\00E7\00E3o'
    when 'entrega' then 'Entrega'
    when 'evento' then 'Evento'
    when 'retirada' then 'Retirada'
    when 'devolucao' then U&'Devolu\00E7\00E3o'
    else new.etapa
  end;

  insert into public.timeline_global (
    empresa_id, reserva_id, entidade_tipo, entidade_id, evento_codigo,
    titulo, descricao, modulo, origem, usuario_id, metadados
  ) values (
    new.empresa_id,
    new.reserva_id,
    'EvidenciaMissao',
    new.id,
    'FOTO_MISSAO_ADICIONADA',
    'Foto adicionada na missão',
    concat(v_etapa, case when nullif(trim(new.descricao), '') is not null then ': ' || trim(new.descricao) else '' end),
    U&'Opera\00E7\00E3o',
    'EvidenceEngine',
    new.criada_por,
    jsonb_build_object(
      'evidencia_id', new.id,
      'ordem_servico_id', new.ordem_servico_id,
      'etapa', new.etapa,
      'tipo', new.tipo
    )
  );

  return new;
end;
$$;

drop trigger if exists registrar_timeline_evidencia_missao on public.evidencias_missao;
create trigger registrar_timeline_evidencia_missao
after insert on public.evidencias_missao
for each row execute function public.registrar_timeline_evidencia_missao();

create or replace function public.atualizar_timestamp_evidencia_missao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists atualizar_timestamp_evidencia_missao on public.evidencias_missao;
create trigger atualizar_timestamp_evidencia_missao
before update on public.evidencias_missao
for each row execute function public.atualizar_timestamp_evidencia_missao();

drop trigger if exists auditar_operacao on public.evidencias_missao;
create trigger auditar_operacao
after insert or update or delete on public.evidencias_missao
for each row execute function public.auditar_entidade_operacional();
