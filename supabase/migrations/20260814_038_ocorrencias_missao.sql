-- Sprint 2.0 - Evidence Engine: ocorrencias operacionais e acompanhamento.

create table if not exists public.ocorrencias_missao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  ordem_servico_id uuid not null references public.ordens_servico(id) on delete cascade,
  tipo text not null,
  etapa text not null,
  prioridade text not null default 'media',
  status text not null default 'aberta',
  titulo text not null,
  descricao text not null,
  responsavel_usuario_id uuid references auth.users(id) on delete set null,
  resolucao text,
  resolvida_em timestamptz,
  resolvida_por uuid references auth.users(id) on delete set null,
  criada_por uuid references auth.users(id) on delete set null,
  atualizada_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ocorrencias_missao_tipo_check check (tipo = any(array['dano', 'item_faltante', 'atraso', 'outro'])),
  constraint ocorrencias_missao_etapa_check check (etapa = any(array['preparacao', 'entrega', 'evento', 'retirada', 'devolucao'])),
  constraint ocorrencias_missao_prioridade_check check (prioridade = any(array['baixa', 'media', 'alta', 'critica'])),
  constraint ocorrencias_missao_status_check check (status = any(array['aberta', 'em_acompanhamento', 'resolvida'])),
  constraint ocorrencias_missao_titulo_check check (char_length(trim(titulo)) between 3 and 160),
  constraint ocorrencias_missao_descricao_check check (char_length(trim(descricao)) between 5 and 2000)
);

create index if not exists ocorrencias_missao_ordem_status_idx
on public.ocorrencias_missao (ordem_servico_id, status, created_at desc);

create index if not exists ocorrencias_missao_responsavel_status_idx
on public.ocorrencias_missao (responsavel_usuario_id, status, updated_at desc);

create table if not exists public.ocorrencias_missao_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  ocorrencia_id uuid not null references public.ocorrencias_missao(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null,
  tamanho_bytes bigint not null default 0,
  criada_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ocorrencias_missao_fotos_tamanho_check check (tamanho_bytes >= 0)
);

create index if not exists ocorrencias_missao_fotos_ocorrencia_idx
on public.ocorrencias_missao_fotos (ocorrencia_id, created_at);

alter table public.ocorrencias_missao enable row level security;
alter table public.ocorrencias_missao_fotos enable row level security;

drop policy if exists "Equipe visualiza ocorrencias da empresa" on public.ocorrencias_missao;
create policy "Equipe visualiza ocorrencias da empresa"
on public.ocorrencias_missao for select to authenticated
using (public.usuario_pertence_empresa(empresa_id));

drop policy if exists "Operacao registra ocorrencias da missao" on public.ocorrencias_missao;
create policy "Operacao registra ocorrencias da missao"
on public.ocorrencias_missao for insert to authenticated
with check (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
  and criada_por = auth.uid()
);

drop policy if exists "Operacao acompanha ocorrencias da missao" on public.ocorrencias_missao;
create policy "Operacao acompanha ocorrencias da missao"
on public.ocorrencias_missao for update to authenticated
using (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
)
with check (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
  and atualizada_por = auth.uid()
);

drop policy if exists "Equipe visualiza fotos de ocorrencias" on public.ocorrencias_missao_fotos;
create policy "Equipe visualiza fotos de ocorrencias"
on public.ocorrencias_missao_fotos for select to authenticated
using (public.usuario_pertence_empresa(empresa_id));

drop policy if exists "Operacao registra fotos de ocorrencias" on public.ocorrencias_missao_fotos;
create policy "Operacao registra fotos de ocorrencias"
on public.ocorrencias_missao_fotos for insert to authenticated
with check (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
  and criada_por = auth.uid()
);

grant select, insert, update on public.ocorrencias_missao to authenticated;
grant select, insert on public.ocorrencias_missao_fotos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ocorrencias-missao',
  'ocorrencias-missao',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Equipe visualiza arquivos de ocorrencias" on storage.objects;
create policy "Equipe visualiza arquivos de ocorrencias"
on storage.objects for select to authenticated
using (
  bucket_id = 'ocorrencias-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Operacao envia arquivos de ocorrencias" on storage.objects;
create policy "Operacao envia arquivos de ocorrencias"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ocorrencias-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

create or replace function public.atualizar_timestamp_ocorrencia_missao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'resolvida' and old.status is distinct from 'resolvida' then
    new.resolvida_em := coalesce(new.resolvida_em, now());
    new.resolvida_por := coalesce(new.resolvida_por, new.atualizada_por, auth.uid());
  elsif new.status <> 'resolvida' then
    new.resolvida_em := null;
    new.resolvida_por := null;
  end if;
  return new;
end;
$$;

drop trigger if exists atualizar_timestamp_ocorrencia_missao on public.ocorrencias_missao;
create trigger atualizar_timestamp_ocorrencia_missao
before update on public.ocorrencias_missao
for each row execute function public.atualizar_timestamp_ocorrencia_missao();

create or replace function public.registrar_timeline_ocorrencia_missao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_titulo text;
  v_usuario_id uuid;
begin
  if tg_op = 'INSERT' then
    v_codigo := 'OCORRENCIA_MISSAO_ABERTA';
    v_titulo := 'Ocorrência aberta na missão';
    v_usuario_id := new.criada_por;
  elsif old.status is distinct from new.status and new.status = 'resolvida' then
    v_codigo := 'OCORRENCIA_MISSAO_RESOLVIDA';
    v_titulo := 'Ocorrência resolvida';
    v_usuario_id := coalesce(new.resolvida_por, new.atualizada_por);
  else
    v_codigo := 'OCORRENCIA_MISSAO_ATUALIZADA';
    v_titulo := 'Ocorrência em acompanhamento';
    v_usuario_id := new.atualizada_por;
  end if;

  insert into public.timeline_global (
    empresa_id, reserva_id, entidade_tipo, entidade_id, evento_codigo,
    titulo, descricao, modulo, origem, usuario_id, metadados
  ) values (
    new.empresa_id,
    new.reserva_id,
    'OcorrenciaMissao',
    new.id,
    v_codigo,
    v_titulo,
    concat(new.titulo, ' · ', replace(new.status, '_', ' '), ' · prioridade ', new.prioridade),
    U&'Opera\00E7\00E3o',
    'EvidenceEngine',
    v_usuario_id,
    jsonb_build_object(
      'ocorrencia_id', new.id,
      'ordem_servico_id', new.ordem_servico_id,
      'tipo', new.tipo,
      'etapa', new.etapa,
      'prioridade', new.prioridade,
      'status', new.status,
      'responsavel_usuario_id', new.responsavel_usuario_id
    )
  );

  return new;
end;
$$;

drop trigger if exists registrar_timeline_ocorrencia_missao on public.ocorrencias_missao;
create trigger registrar_timeline_ocorrencia_missao
after insert or update of status, prioridade, responsavel_usuario_id, resolucao
on public.ocorrencias_missao
for each row execute function public.registrar_timeline_ocorrencia_missao();

create or replace function public.auditar_evidence_engine()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registro jsonb;
  v_anterior jsonb;
  v_novo jsonb;
  v_empresa_id uuid;
  v_usuario_id uuid;
  v_acao text;
begin
  if tg_op = 'DELETE' then
    v_registro := to_jsonb(old);
    v_anterior := v_registro;
    v_acao := 'EXCLUIR';
  elsif tg_op = 'INSERT' then
    v_registro := to_jsonb(new);
    v_novo := v_registro;
    v_acao := 'CRIAR';
  else
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    v_registro := to_jsonb(new);
    v_anterior := to_jsonb(old);
    v_novo := to_jsonb(new);
    v_acao := 'ATUALIZAR';
  end if;

  v_empresa_id := nullif(v_registro ->> 'empresa_id', '')::uuid;
  v_usuario_id := coalesce(
    auth.uid(),
    nullif(v_registro ->> 'atualizada_por', '')::uuid,
    nullif(v_registro ->> 'resolvida_por', '')::uuid,
    nullif(v_registro ->> 'criada_por', '')::uuid,
    nullif(v_registro ->> 'registrada_por', '')::uuid
  );

  v_anterior := v_anterior - 'storage_path';
  v_novo := v_novo - 'storage_path';

  insert into public.auditoria_logs (
    empresa_id, usuario_id, entidade, entidade_id, acao, dados_anteriores, dados_novos
  ) values (
    v_empresa_id, v_usuario_id, tg_table_name, v_registro ->> 'id', v_acao, v_anterior, v_novo
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists auditar_operacao on public.ocorrencias_missao;
create trigger auditar_operacao
after insert or update on public.ocorrencias_missao
for each row execute function public.auditar_evidence_engine();

drop trigger if exists auditar_operacao on public.ocorrencias_missao_fotos;
create trigger auditar_operacao
after insert on public.ocorrencias_missao_fotos
for each row execute function public.auditar_evidence_engine();
