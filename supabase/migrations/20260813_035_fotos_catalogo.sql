-- Fotos públicas e otimizadas para os cadastros de Kits e Estoque.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalogo-fotos',
  'catalogo-fotos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Fotos do catalogo sao publicas" on storage.objects;
create policy "Fotos do catalogo sao publicas"
on storage.objects for select
using (bucket_id = 'catalogo-fotos');

drop policy if exists "Equipe envia fotos do catalogo" on storage.objects;
create policy "Equipe envia fotos do catalogo"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'catalogo-fotos'
  and (storage.foldername(name))[1] = any(array['kits', 'estoque'])
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

drop policy if exists "Equipe atualiza fotos do catalogo" on storage.objects;
create policy "Equipe atualiza fotos do catalogo"
on storage.objects for update to authenticated
using (
  bucket_id = 'catalogo-fotos'
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
)
with check (
  bucket_id = 'catalogo-fotos'
  and (storage.foldername(name))[1] = any(array['kits', 'estoque'])
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);

drop policy if exists "Equipe remove fotos do catalogo" on storage.objects;
create policy "Equipe remove fotos do catalogo"
on storage.objects for delete to authenticated
using (
  bucket_id = 'catalogo-fotos'
  and public.usuario_tem_perfil(array[U&'Opera\00E7\00E3o', 'Estoque'])
);
