import { NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import type { PerfilUsuario } from '@/lib/access'

export class AcessoAdministrativoError extends Error {
  status: number

  constructor(message: string, status = 403) {
    super(message)
    this.name = 'AcessoAdministrativoError'
    this.status = status
  }
}

function tokenDaRequisicao(request: NextRequest) {
  const autorizacao = request.headers.get('authorization') || ''
  return autorizacao.startsWith('Bearer ') ? autorizacao.slice(7).trim() : ''
}

export async function exigirAdministrador(request: NextRequest) {
  return exigirPerfis(request, [])
}

export async function exigirPerfis(
  request: NextRequest,
  perfis: Exclude<PerfilUsuario, 'Administrador'>[]
) {
  const token = tokenDaRequisicao(request)
  if (!token) throw new AcessoAdministrativoError('Sessão não informada.', 401)

  const { data: usuario, error: usuarioError } = await supabaseServer.auth.getUser(token)
  if (usuarioError || !usuario.user) {
    throw new AcessoAdministrativoError('Sessão inválida ou expirada.', 401)
  }

  const { data: vinculo, error: vinculoError } = await supabaseServer
    .from('usuarios_empresa')
    .select('id,usuario_id,empresa_id,nome,perfil,ativo')
    .eq('usuario_id', usuario.user.id)
    .in('perfil', ['Administrador', ...perfis])
    .eq('ativo', true)
    .maybeSingle()

  if (vinculoError) throw new AcessoAdministrativoError(vinculoError.message, 500)
  if (!vinculo) throw new AcessoAdministrativoError('Seu perfil não possui permissão para esta ação.')

  return { usuario: usuario.user, vinculo }
}

export function respostaErroAdministrativo(error: unknown) {
  if (error instanceof AcessoAdministrativoError) {
    return { mensagem: error.message, status: error.status }
  }

  return {
    mensagem: error instanceof Error ? error.message : 'Não foi possível concluir a operação.',
    status: 400
  }
}
