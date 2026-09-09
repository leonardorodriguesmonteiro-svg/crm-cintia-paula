-- Remove confirmadores experimentais caso a versão anterior da consolidação
-- tenha sido aplicada em algum ambiente de homologação. O finalizador V2 é a
-- única autoridade para confirmar reserva e estoque.

drop trigger if exists proteger_confirmacao_reserva_formalizacao
on public.reservas;

drop function if exists public.proteger_confirmacao_reserva_formalizacao();

drop trigger if exists confirmar_reserva_apos_formalizacao
on public.orcamentos;

drop function if exists public.confirmar_reserva_apos_formalizacao();
