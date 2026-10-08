-- Payment preferences are recorded only by the server after company authorization.
revoke all on function public.registrar_preferencia_mercado_pago(uuid,text,text) from public,anon,authenticated;
grant execute on function public.registrar_preferencia_mercado_pago(uuid,text,text) to service_role;
