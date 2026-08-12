import { NextRequest, NextResponse } from 'next/server'
import { perfilValido } from '@/lib/access'
import { exigirAdministrador, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  try {
    const { usuario: ator, vinculo: administrador } = await exigirAdministrador(request)
    const { id } = await contexto.params
    const corpo = await request.json().catch(() => ({}))
    const nome = String(corpo.nome || '').trim()
    const perfil = corpo.perfil
    const ativo = corpo.ativo

    if (nome.length < 2) return NextResponse.json({ error: 'Informe o nome do usuário.' }, { status: 400 })
    if (!perfilValido(perfil)) return NextResponse.json({ error: 'Selecione um perfil válido.' }, { status: 400 })
    if (typeof ativo !== 'boolean') return NextResponse.json({ error: 'Informe o status do usuário.' }, { status: 400 })

    const { data: atual, error: atualError } = await supabaseServer
      .from('usuarios_empresa')
      .select('id,usuario_id,empresa_id,nome,perfil,ativo')
      .eq('usuario_id', id)
      .eq('empresa_id', administrador.empresa_id)
      .maybeSingle()

    if (atualError) throw atualError
    if (!atual) return NextResponse.json({ error: 'Usuário não encontrado nesta empresa.' }, { status: 404 })

    const removendoAdministrador = atual.ativo && atual.perfil === 'Administrador' && (!ativo || perfil !== 'Administrador')
    if (removendoAdministrador) {
      const { count, error } = await supabaseServer
        .from('usuarios_empresa')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', administrador.empresa_id)
        .eq('perfil', 'Administrador')
        .eq('ativo', true)

      if (error) throw error
      if ((count || 0) <= 1) {
        return NextResponse.json({ error: 'A empresa precisa manter pelo menos um administrador ativo.' }, { status: 400 })
      }
    }

    const { data: usuarioAuth, error: usuarioAuthError } = await supabaseServer.auth.admin.getUserById(id)
    if (usuarioAuthError) throw usuarioAuthError

    const { error: authError } = await supabaseServer.auth.admin.updateUserById(id, {
      user_metadata: { ...usuarioAuth.user.user_metadata, nome }
    })
    if (authError) throw authError

    const { error: vinculoError } = await supabaseServer
      .from('usuarios_empresa')
      .update({
        nome,
        perfil,
        ativo,
        updated_at: new Date().toISOString(),
        updated_by: ator.id
      })
      .eq('id', atual.id)

    if (vinculoError) throw vinculoError

    return NextResponse.json({ sucesso: true, mensagem: 'Acesso do usuário atualizado.' })
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}
