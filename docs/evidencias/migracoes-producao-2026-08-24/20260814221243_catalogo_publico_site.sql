revoke all on table public.kits from anon;
grant select (id, nome, tema, categoria, valor, valor_fim_semana, foto_url, descricao, status) on table public.kits to anon;

drop policy if exists catalogo_publico_kits on public.kits;
create policy catalogo_publico_kits
on public.kits
for select
to anon
using (lower(trim(coalesce(status, ''))) = 'disponível');

revoke all on function public.verificar_disponibilidade_kit(uuid, date, date, uuid) from anon;
grant execute on function public.verificar_disponibilidade_kit(uuid, date, date, uuid) to anon;
