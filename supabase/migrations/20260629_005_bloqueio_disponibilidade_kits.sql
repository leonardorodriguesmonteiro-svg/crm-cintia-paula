create or replace function public.bloquear_reserva_duplicada_kit_data()
returns trigger as $$
declare
  qtd_kit integer;
  qtd_reservada integer;
begin
  if lower(trim(new.status)) = 'confirmada' then
    select coalesce(quantidade, 1)
    into qtd_kit
    from public.kits
    where id = new.kit_id;

    select count(*)
    into qtd_reservada
    from public.reservas r
    where r.kit_id = new.kit_id
      and r.data_evento = new.data_evento
      and lower(trim(r.status)) = 'confirmada'
      and r.id <> new.id;

    if qtd_reservada >= qtd_kit then
      raise exception 'Este kit não possui mais disponibilidade para esta data.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;
