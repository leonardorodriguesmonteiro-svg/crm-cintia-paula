'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Mail, Pencil, Plus, Search, ShieldCheck, UserCheck, UserX, X } from 'lucide-react'
import { PERFIS, type PerfilUsuario } from '@/lib/access'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type UsuarioPainel = {
  id: string
  usuario_id: string
  email: string
  email_confirmado: boolean
  nome: string
  perfil: PerfilUsuario
  ativo: boolean
  ultimo_acesso: string | null
  criado_em: string
}

type FormularioUsuario = {
  nome: string
  email: string
  perfil: PerfilUsuario
}

const formularioInicial: FormularioUsuario = {
  nome: '',
  email: '',
  perfil: 'Comercial'
}

function dataHora(valor: string | null) {
  if (!valor) return 'Nunca acessou'
  return new Date(valor).toLocaleString('pt-BR')
}

async function tokenSessao() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre novamente no ERP.')
  return token
}

export function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<UsuarioPainel[]>([])
  const [busca, setBusca] = useState('')
  const [formulario, setFormulario] = useState(formularioInicial)
  const [editando, setEditando] = useState<UsuarioPainel | null>(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')

    try {
      const token = await tokenSessao()
      const resposta = await fetch('/api/administracao/usuarios', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível carregar os usuários.')
      setUsuarios(corpo.usuarios || [])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar os usuários.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const resumo = useMemo(() => ({
    total: usuarios.length,
    ativos: usuarios.filter(item => item.ativo).length,
    administradores: usuarios.filter(item => item.ativo && item.perfil === 'Administrador').length,
    pendentes: usuarios.filter(item => !item.email_confirmado).length
  }), [usuarios])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return usuarios
    return usuarios.filter(item => [item.nome, item.email, item.perfil]
      .join(' ')
      .toLowerCase()
      .includes(termo))
  }, [usuarios, busca])

  function atualizarFormulario(campo: keyof FormularioUsuario, valor: string) {
    setFormulario(atual => ({ ...atual, [campo]: valor }))
  }

  async function criarUsuario(evento: React.FormEvent) {
    evento.preventDefault()
    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      const token = await tokenSessao()
      const resposta = await fetch('/api/administracao/usuarios', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formulario)
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível criar o usuário.')

      setSucesso(corpo.mensagem || 'Usuário criado com sucesso.')
      setFormulario(formularioInicial)
      setMostrarFormulario(false)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível criar o usuário.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvarEdicao(evento: React.FormEvent) {
    evento.preventDefault()
    if (!editando) return
    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      const token = await tokenSessao()
      const resposta = await fetch(`/api/administracao/usuarios/${editando.usuario_id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nome: editando.nome,
          perfil: editando.perfil,
          ativo: editando.ativo
        })
      })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível atualizar o usuário.')

      setSucesso(corpo.mensagem || 'Usuário atualizado.')
      setEditando(null)
      await carregar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6 p-4 pb-28 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p>
          <h1 className="text-3xl font-bold text-slate-900">Usuários e acessos</h1>
          <p className="mt-1 text-slate-500">Convide a equipe e controle o perfil de cada usuário.</p>
        </div>
        <Button type="button" onClick={() => setMostrarFormulario(true)} className="flex items-center justify-center gap-2">
          <Plus size={18} /> Criar usuário
        </Button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700"><CheckCircle2 className="mt-0.5 shrink-0" size={17} />{sucesso}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-slate-500">Usuários</p><p className="mt-2 text-3xl font-bold text-slate-900">{resumo.total}</p></Card>
        <Card><p className="text-sm text-slate-500">Ativos</p><p className="mt-2 text-3xl font-bold text-green-700">{resumo.ativos}</p></Card>
        <Card><p className="text-sm text-slate-500">Administradores</p><p className="mt-2 text-3xl font-bold text-pink-700">{resumo.administradores}</p></Card>
        <Card><p className="text-sm text-slate-500">Convites pendentes</p><p className="mt-2 text-3xl font-bold text-amber-700">{resumo.pendentes}</p></Card>
      </div>

      {mostrarFormulario && (
        <Card>
          <form onSubmit={criarUsuario} className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-bold text-slate-900">Novo usuário</h2><p className="text-sm text-slate-500">O usuário receberá um convite para definir o acesso.</p></div>
              <button type="button" aria-label="Fechar formulário" onClick={() => setMostrarFormulario(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input label="Nome *" value={formulario.nome} onChange={evento => atualizarFormulario('nome', evento.target.value)} placeholder="Nome da pessoa" />
              <Input label="E-mail *" type="email" value={formulario.email} onChange={evento => atualizarFormulario('email', evento.target.value)} placeholder="pessoa@email.com" />
              <Select label="Perfil" value={formulario.perfil} onChange={evento => atualizarFormulario('perfil', evento.target.value)}>
                {PERFIS.map(perfil => <option key={perfil} value={perfil}>{perfil}</option>)}
              </Select>
            </div>
            <div className="flex justify-end"><Button type="submit" disabled={salvando}>{salvando ? 'Enviando convite...' : 'Criar e enviar convite'}</Button></div>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-lg font-bold text-slate-900">Equipe cadastrada</h2><p className="text-sm text-slate-500">Alterações de perfil e status ficam registradas na auditoria.</p></div>
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input value={busca} onChange={evento => setBusca(evento.target.value)} placeholder="Buscar usuário..." className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none focus:border-pink-400" /></div>
        </div>

        <div className="mt-5 space-y-3">
          {filtrados.map(usuario => (
            <div key={usuario.id} className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-slate-900">{usuario.nome || usuario.email}</p>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${usuario.ativo ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{usuario.ativo ? 'Ativo' : 'Desativado'}</span>
                  {!usuario.email_confirmado && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Convite pendente</span>}
                </div>
                <p className="mt-1 flex items-center gap-2 truncate text-sm text-slate-500"><Mail size={15} />{usuario.email}</p>
                <p className="mt-1 text-xs text-slate-400">Último acesso: {dataHora(usuario.ultimo_acesso)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-2 rounded-xl bg-pink-50 px-3 py-2 text-sm font-semibold text-pink-700"><ShieldCheck size={16} />{usuario.perfil}</span>
                <button type="button" onClick={() => setEditando({ ...usuario })} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={16} />Editar</button>
              </div>
            </div>
          ))}
          {!carregando && filtrados.length === 0 && <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Nenhum usuário encontrado.</div>}
          {carregando && <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">Carregando usuários...</div>}
        </div>
      </Card>

      {editando && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={salvarEdicao} className="w-full max-w-lg space-y-5 rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Editar acesso</h2><p className="text-sm text-slate-500">{editando.email}</p></div><button type="button" aria-label="Fechar edição" onClick={() => setEditando(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19} /></button></div>
            <Input label="Nome" value={editando.nome} onChange={evento => setEditando(atual => atual ? { ...atual, nome: evento.target.value } : atual)} />
            <Select label="Perfil" value={editando.perfil} onChange={evento => setEditando(atual => atual ? { ...atual, perfil: evento.target.value as PerfilUsuario } : atual)}>
              {PERFIS.map(perfil => <option key={perfil} value={perfil}>{perfil}</option>)}
            </Select>
            <button type="button" onClick={() => setEditando(atual => atual ? { ...atual, ativo: !atual.ativo } : atual)} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left ${editando.ativo ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
              <span><span className="block font-bold text-slate-900">Acesso ao sistema</span><span className="text-sm text-slate-500">{editando.ativo ? 'Usuário pode entrar e usar os módulos permitidos.' : 'Usuário não poderá acessar o ERP.'}</span></span>
              {editando.ativo ? <UserCheck className="text-green-700" /> : <UserX className="text-slate-500" />}
            </button>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEditando(null)}>Cancelar</Button><Button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar acesso'}</Button></div>
          </form>
        </div>
      )}
    </div>
  )
}
