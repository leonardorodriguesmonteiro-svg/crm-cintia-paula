-- Sprint Comercial 1.1 - Hardening da superfície RPC.
-- A consulta de disponibilidade é usada pelo ERP autenticado e pelo servidor,
-- mas não deve ficar exposta ao papel anon por privilégio padrão do PostgreSQL.

revoke all on function public.verificar_disponibilidade_kit(uuid, date, date, uuid)
from public, anon;

grant execute on function public.verificar_disponibilidade_kit(uuid, date, date, uuid)
to authenticated, service_role;
