create table if not exists public.site_pre_reservas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  kit_id uuid not null references public.kits(id),
  data_festa date not null,
  nome text not null,
  whatsapp text not null,
  email text not null,
  cpf text,
  valor_kit numeric(12,2) not null check (valor_kit >= 0),
  caucao numeric(12,2) not null default 0 check (caucao >= 0),
  status text not null default 'Aguardando confirmação',
  origem text not null default 'Site',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_pre_reservas enable row level security;
revoke all on public.site_pre_reservas from anon, authenticated;
create index if not exists site_pre_reservas_kit_data_idx on public.site_pre_reservas (kit_id,data_festa);
create index if not exists site_pre_reservas_status_created_idx on public.site_pre_reservas (status,created_at desc);

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.criar_pre_reserva_site_impl(p_kit_id uuid,p_data_festa date,p_nome text,p_whatsapp text,p_email text,p_cpf text default null,p_valor_kit numeric default 0,p_caucao numeric default 0)
returns jsonb language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_codigo text; v_kit public.kits%rowtype; v_disp jsonb; v_valor numeric;
begin
 if p_data_festa<current_date then raise exception 'Escolha uma data futura.' using errcode='22007'; end if;
 if length(trim(p_nome))<2 or length(regexp_replace(p_whatsapp,'\D','','g'))<10 or position('@' in p_email)<2 then raise exception 'Dados do cliente inválidos.' using errcode='22023'; end if;
 select * into v_kit from public.kits where id=p_kit_id and status ilike 'Disponível';
 if not found then raise exception 'Kit não encontrado ou indisponível.' using errcode='P0002'; end if;
 select public.verificar_disponibilidade_kit(p_kit_id,p_data_festa,p_data_festa,null)::jsonb into v_disp;
 if coalesce((v_disp->>'disponivel')::boolean,false)=false then raise exception 'Este kit não está disponível na data escolhida.' using errcode='23505'; end if;
 if exists(select 1 from public.site_pre_reservas where kit_id=p_kit_id and data_festa=p_data_festa and whatsapp=regexp_replace(p_whatsapp,'\D','','g') and created_at>now()-interval '10 minutes') then raise exception 'Este pedido já foi recebido. Aguarde a confirmação da equipe.' using errcode='23505'; end if;
 v_valor:=case when extract(isodow from p_data_festa) in (6,7) and coalesce(v_kit.valor_fim_semana,0)>0 then v_kit.valor_fim_semana else coalesce(v_kit.valor,0) end;
 v_codigo:='CP-'||to_char(clock_timestamp(),'YYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.site_pre_reservas(codigo,kit_id,data_festa,nome,whatsapp,email,cpf,valor_kit,caucao) values(v_codigo,p_kit_id,p_data_festa,trim(p_nome),regexp_replace(p_whatsapp,'\D','','g'),lower(trim(p_email)),nullif(regexp_replace(coalesce(p_cpf,''),'\D','','g'),''),v_valor,greatest(p_caucao,0));
 return jsonb_build_object('codigo',v_codigo,'mensagem','Pedido recebido. A equipe confirmará a disponibilidade antes do pagamento.');
end $$;

revoke all on function private.criar_pre_reserva_site_impl(uuid,date,text,text,text,text,numeric,numeric) from public;
grant usage on schema private to anon;
grant execute on function private.criar_pre_reserva_site_impl(uuid,date,text,text,text,text,numeric,numeric) to anon;

create or replace function public.criar_pre_reserva_site(p_kit_id uuid,p_data_festa date,p_nome text,p_whatsapp text,p_email text,p_cpf text default null,p_valor_kit numeric default 0,p_caucao numeric default 0)
returns jsonb language sql security invoker set search_path=public,private,pg_temp as $$
 select private.criar_pre_reserva_site_impl(p_kit_id,p_data_festa,p_nome,p_whatsapp,p_email,p_cpf,p_valor_kit,p_caucao);
$$;
revoke all on function public.criar_pre_reserva_site(uuid,date,text,text,text,text,numeric,numeric) from public;
grant execute on function public.criar_pre_reserva_site(uuid,date,text,text,text,text,numeric,numeric) to anon;
