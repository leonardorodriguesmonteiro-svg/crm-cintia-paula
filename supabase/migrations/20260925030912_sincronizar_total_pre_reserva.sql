-- Mantem o total comercial da pre-reserva sincronizado com os snapshots
-- dos itens. O trigger anterior preenche o valor de referencia antes desta
-- consolidacao, inclusive para itens avulsos do estoque.

create or replace function public.sincronizar_total_pre_reserva()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oportunidade_id uuid := coalesce(new.oportunidade_id, old.oportunidade_id);
  v_empresa_id uuid := coalesce(new.empresa_id, old.empresa_id);
  v_subtotal numeric(12, 2);
  v_desconto numeric(12, 2);
begin
  select round(coalesce(sum(item.quantidade * item.valor_referencia), 0), 2)
    into v_subtotal
  from public.oportunidade_itens item
  where item.oportunidade_id = v_oportunidade_id
    and item.empresa_id = v_empresa_id;

  select least(
    case
      when oportunidade.desconto_tipo = 'PERCENTUAL'
        then round(v_subtotal * oportunidade.desconto_valor / 100, 2)
      else round(oportunidade.desconto_valor, 2)
    end,
    v_subtotal
  )
    into v_desconto
  from public.oportunidades oportunidade
  where oportunidade.id = v_oportunidade_id
    and oportunidade.empresa_id = v_empresa_id;

  update public.oportunidades
  set desconto_calculado = coalesce(v_desconto, 0),
      valor_estimado = greatest(v_subtotal - coalesce(v_desconto, 0), 0),
      versao = versao + 1,
      updated_at = now()
  where id = v_oportunidade_id
    and empresa_id = v_empresa_id
    and (
      desconto_calculado is distinct from coalesce(v_desconto, 0)
      or valor_estimado is distinct from greatest(v_subtotal - coalesce(v_desconto, 0), 0)
    );

  return coalesce(new, old);
end;
$$;

drop trigger if exists oportunidade_itens_sincronizar_total
  on public.oportunidade_itens;

create trigger oportunidade_itens_sincronizar_total
after insert or update of quantidade, valor_referencia, oportunidade_id, empresa_id or delete
on public.oportunidade_itens
for each row execute function public.sincronizar_total_pre_reserva();

revoke all on function public.sincronizar_total_pre_reserva()
  from public, anon, authenticated;

-- Corrige oportunidades criadas entre a primeira migration e este trigger.
with totais as (
  select
    item.empresa_id,
    item.oportunidade_id,
    round(coalesce(sum(item.quantidade * item.valor_referencia), 0), 2) as subtotal
  from public.oportunidade_itens item
  group by item.empresa_id, item.oportunidade_id
), ajustes as (
  select
    oportunidade.id,
    total.subtotal,
    least(
      case
        when oportunidade.desconto_tipo = 'PERCENTUAL'
          then round(total.subtotal * oportunidade.desconto_valor / 100, 2)
        else round(oportunidade.desconto_valor, 2)
      end,
      total.subtotal
    ) as desconto
  from public.oportunidades oportunidade
  join totais total
    on total.oportunidade_id = oportunidade.id
   and total.empresa_id = oportunidade.empresa_id
  where oportunidade.etapa in (
    'RECEBIDA', 'EM_ANALISE', 'AJUSTE_SOLICITADO',
    'APROVADA', 'CONVERTIDA_EM_PROPOSTA'
  )
)
update public.oportunidades oportunidade
set desconto_calculado = ajuste.desconto,
    valor_estimado = greatest(ajuste.subtotal - ajuste.desconto, 0),
    versao = oportunidade.versao + 1,
    updated_at = now()
from ajustes ajuste
where oportunidade.id = ajuste.id
  and (
    oportunidade.desconto_calculado is distinct from ajuste.desconto
    or oportunidade.valor_estimado is distinct from greatest(ajuste.subtotal - ajuste.desconto, 0)
  );
