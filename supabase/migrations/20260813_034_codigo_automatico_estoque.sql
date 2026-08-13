create or replace function public.gerar_codigo_automatico_estoque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proximo_numero integer;
begin
  if nullif(btrim(new.codigo), '') is not null then
    new.codigo := btrim(new.codigo);
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('estoque_itens_codigo_automatico'));

  select coalesce(max(substring(codigo from '^EST-([0-9]+)$')::integer), 0) + 1
    into proximo_numero
    from public.estoque_itens
   where codigo ~ '^EST-[0-9]+$'
     and (tg_op <> 'UPDATE' or id <> new.id);

  new.codigo := 'EST-' || lpad(proximo_numero::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists estoque_itens_codigo_automatico on public.estoque_itens;
create trigger estoque_itens_codigo_automatico
before insert or update of codigo on public.estoque_itens
for each row
execute function public.gerar_codigo_automatico_estoque();

comment on function public.gerar_codigo_automatico_estoque() is
'Gera códigos sequenciais EST-0001 para itens cadastrados sem código interno.';
