create or replace function public.registrar_timeline_reserva_criada()
returns trigger as $$
begin
  insert into public.reserva_timeline (reserva_id, titulo, descricao, tipo)
  values (new.id, 'Reserva criada', 'A reserva foi cadastrada no sistema.', 'Sistema');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_timeline_reserva_criada on public.reservas;

create trigger trg_timeline_reserva_criada
after insert on public.reservas
for each row
execute function public.registrar_timeline_reserva_criada();

create or replace function public.registrar_timeline_reserva_editada()
returns trigger as $$
begin
  if old.status is distinct from new.status then
    insert into public.reserva_timeline (reserva_id, titulo, descricao, tipo)
    values (new.id, 'Status alterado', 'Status alterado de ' || coalesce(old.status, '-') || ' para ' || coalesce(new.status, '-') || '.', 'Edição');
  else
    insert into public.reserva_timeline (reserva_id, titulo, descricao, tipo)
    values (new.id, 'Reserva editada', 'Dados da reserva atualizados.', 'Edição');
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_timeline_reserva_editada on public.reservas;

create trigger trg_timeline_reserva_editada
after update on public.reservas
for each row
execute function public.registrar_timeline_reserva_editada();

create or replace function public.registrar_timeline_recebimento()
returns trigger as $$
begin
  insert into public.reserva_timeline (reserva_id, titulo, descricao, tipo)
  values (new.reserva_id, 'Recebimento registrado', 'Recebimento de R$ ' || new.valor || ' via ' || coalesce(new.forma_pagamento, '-') || '.', 'Financeiro');

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_timeline_recebimento on public.recebimentos;

create trigger trg_timeline_recebimento
after insert on public.recebimentos
for each row
execute function public.registrar_timeline_recebimento();
