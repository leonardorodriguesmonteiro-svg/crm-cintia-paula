-- Sprint 2.0 - Evidence Engine: assinaturas digitais operacionais.

create table if not exists public.assinaturas_missao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  reserva_id uuid not null references public.reservas(id) on delete cascade,
  ordem_servico_id uuid not null references public.ordens_servico(id) on delete cascade,
  etapa text not null,
  nome_assinante text not null,
  storage_path text not null unique,
  mime_type text not null default 'image/png',
  assinada_em timestamptz not null default now(),
  registrada_por uuid references auth.users(id) on delete set null,
  metadados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint assinaturas_missao_etapa_check check (etapa = any(array['entrega', 'retirada'])),
  constraint assinaturas_missao_nome_check check (char_length(trim(nome_assinante)) between 2 and 120),
  constraint assinaturas_missao_etapa_unica unique (ordem_servico_id, etapa)
);

create index if not exists assinaturas_missao_reserva_data_idx
on public.assinaturas_missao (reserva_id, assinada_em desc);

alter table public.assinaturas_missao enable row level security;

drop policy if exists "Equipe visualiza assinaturas da empresa" on public.assinaturas_missao;
create policy "Equipe visualiza assinaturas da empresa"
on public.assinaturas_missao for select to authenticated
using (public.usuario_pertence_empresa(empresa_id));

drop policy if exists "Operacao registra assinatura da missao" on public.assinaturas_missao;
create policy "Operacao registra assinatura da missao"
on public.assinaturas_missao for insert to authenticated
with check (
  public.usuario_pertence_empresa(empresa_id)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o'])
  and registrada_por = auth.uid()
);

grant select, insert on public.assinaturas_missao to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assinaturas-missao',
  'assinaturas-missao',
  false,
  1048576,
  array['image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Equipe visualiza arquivos de assinatura" on storage.objects;
create policy "Equipe visualiza arquivos de assinatura"
on storage.objects for select to authenticated
using (
  bucket_id = 'assinaturas-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
);

drop policy if exists "Operacao envia arquivos de assinatura" on storage.objects;
create policy "Operacao envia arquivos de assinatura"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assinaturas-missao'
  and public.usuario_pertence_empresa((storage.foldername(name))[1]::uuid)
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o'])
);

create or replace function public.registrar_timeline_assinatura_missao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa text;
begin
  v_etapa := case new.etapa
    when 'entrega' then 'entrega'
    when 'retirada' then 'retirada'
    else new.etapa
  end;

  insert into public.timeline_global (
    empresa_id, reserva_id, entidade_tipo, entidade_id, evento_codigo,
    titulo, descricao, modulo, origem, usuario_id, metadados
  ) values (
    new.empresa_id,
    new.reserva_id,
    'AssinaturaMissao',
    new.id,
    case when new.etapa = 'entrega'
      then 'ASSINATURA_ENTREGA_REGISTRADA'
      else 'ASSINATURA_RETIRADA_REGISTRADA'
    end,
    case when new.etapa = 'entrega'
      then 'Assinatura registrada na entrega'
      else 'Assinatura registrada na retirada'
    end,
    concat('Assinado por ', new.nome_assinante, ' na ', v_etapa, '.'),
    U&'Opera\00E7\00E3o',
    'EvidenceEngine',
    new.registrada_por,
    jsonb_build_object(
      'assinatura_id', new.id,
      'ordem_servico_id', new.ordem_servico_id,
      'etapa', new.etapa,
      'nome_assinante', new.nome_assinante,
      'assinada_em', new.assinada_em
    )
  );

  return new;
end;
$$;

drop trigger if exists registrar_timeline_assinatura_missao on public.assinaturas_missao;
create trigger registrar_timeline_assinatura_missao
after insert on public.assinaturas_missao
for each row execute function public.registrar_timeline_assinatura_missao();

drop trigger if exists auditar_operacao on public.assinaturas_missao;
create trigger auditar_operacao
after insert on public.assinaturas_missao
for each row execute function public.auditar_entidade_operacional();
