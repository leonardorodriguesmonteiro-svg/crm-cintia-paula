import { NextRequest, NextResponse } from 'next/server'
import { perfilValido } from '@/lib/access'
import { exigirAdministrador, respostaErroAdministrativo } from '@/lib/server/adminAuth'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizarEmail(valor: unknown) {
  return String(valor || '').trim().toLowerCase()
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function listarTodosUsuarios() {
  const usuarios = []
  let pagina = 1

  while (pagina <= 10) {
    const { data, error } = await supabaseServer.auth.admin.listUsers({ page: pagina, perPage: 100 })
    if (error) throw error
    usuarios.push(...data.users)
    if (data.users.length < 100) break
    pagina += 1
  }

  return usuarios
}

export async function GET(request: NextRequest) {
  try {
    const { vinculo: administrador } = await exigirAdministrador(request)
    const [usuariosAuth, vinculosRes] = await Promise.all([
      listarTodosUsuarios(),
      supabaseServer
        .from('usuarios_empresa')
        .select('id,usuario_id,empresa_id,nome,perfil,ativo,created_at,updated_at')
        .eq('empresa_id', administrador.empresa_id)
        .order('nome')
    ])

    if (vinculosRes.error) throw vinculosRes.error

    const vinculos = new Map((vinculosRes.data || []).map(item => [item.usuario_id, item]))
    const dados = usuariosAuth
      .filter(usuario => vinculos.has(usuario.id))
      .map(usuario => ({
        id: usuario.id,
        email: usuario.email || '',
        email_confirmado: Boolean(usuario.email_confirmed_at),
        ultimo_acesso: usuario.last_sign_in_at || null,
        criado_em: usuario.created_at,
        ...vinculos.get(usuario.id)
      }))
      .sort((a, b) => String(a.nome || a.email).localeCompare(String(b.nome || b.email), 'pt-BR'))

    return NextResponse.json({ usuarios: dados })
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { usuario: ator, vinculo: administrador } = await exigirAdministrador(request)
    const corpo = await request.json().catch(() => ({}))
    const nome = String(corpo.nome || '').trim()
    const email = normalizarEmail(corpo.email)
    const perfil = corpo.perfil

    if (nome.length < 2) return NextResponse.json({ error: 'Informe o nome do usuário.' }, { status: 400 })
    if (!emailValido(email)) return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
    if (!perfilValido(perfil)) return NextResponse.json({ error: 'Selecione um perfil válido.' }, { status: 400 })

    const usuarios = await listarTodosUsuarios()
    let usuarioAuth = usuarios.find(item => item.email?.toLowerCase() === email)
    let conviteEnviado = false

    if (!usuarioAuth) {
      const origem = new URL(request.url).origin
      const { data, error } = await supabaseServer.auth.admin.inviteUserByEmail(email, {
        data: { nome },
        redirectTo: `${origem}/redefinir-senha`
      })
      if (error) throw error
      usuarioAuth = data.user
      conviteEnviado = true
    } else {
      const { error } = await supabaseServer.auth.admin.updateUserById(usuarioAuth.id, {
        user_metadata: { ...usuarioAuth.user_metadata, nome }
      })
      if (error) throw error
    }

    if (!usuarioAuth) throw new Error('Não foi possível criar ou localizar o usuário.')

    const { error: vinculoError } = await supabaseServer
      .from('usuarios_empresa')
      .upsert({
        usuario_id: usuarioAuth.id,
        empresa_id: administrador.empresa_id,
        nome,
        perfil,
        ativo: true,
        updated_at: new Date().toISOString(),
        updated_by: ator.id
      }, { onConflict: 'usuario_id,empresa_id' })

    if (vinculoError) throw vinculoError

    return NextResponse.json({
      sucesso: true,
      usuario_id: usuarioAuth.id,
      mensagem: conviteEnviado
        ? `Convite enviado para ${email}.`
        : 'Usuário existente vinculado e atualizado com sucesso.'
    })
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}
