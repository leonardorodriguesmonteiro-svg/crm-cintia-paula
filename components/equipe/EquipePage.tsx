'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Colaborador = {
  id: string
  nome: string
  telefone: string | null
  funcao: string | null
  especialidades: string | null
  possui_veiculo: boolean
  observacoes: string | null
  ativo: boolean
}

const formularioVazio = {
  nome: '',
  telefone: '',
  funcao: 'Montagem',
  especialidades: '',
  possui_veiculo: 'Não',
  observacoes: '',
  ativo: 'Sim'
}

export function EquipePage() {
  const [equipe, setEquipe] = useState<Colaborador[]>([])
  const [form, setForm] = useState(formularioVazio)
  const [editando, setEditando] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setErro('')

    const { data, error } = await supabase
      .from('equipe')
      .select('*')
      .order('ativo', { ascending: false })
      .order('nome', { ascending: true })

    if (error) {
      setErro(error.message)
      return
    }

    setEquipe(data || [])
  }

  useEffect(() => {
    carregar()
  }, [])

  const equipeFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    if (!termo) return equipe

    return equipe.filter(item =>
      [
        item.nome,
        item.telefone,
        item.funcao,
        item.especialidades,
        item.ativo ? 'ativo' : 'inativo'
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(termo)
    )
  }, [equipe, busca])

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')

    if (!form.nome.trim()) {
      setErro('Informe o nome do colaborador.')
      return
    }

    setSalvando(true)

    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      funcao: form.funcao || null,
      especialidades: form.especialidades.trim() || null,
      possui_veiculo: form.possui_veiculo === 'Sim',
      observacoes: form.observacoes.trim() || null,
      ativo: form.ativo === 'Sim',
      updated_at: new Date().toISOString()
    }

    const resposta = editando
      ? await supabase
          .from('equipe')
          .update(payload)
          .eq('id', editando)
      : await supabase
          .from('equipe')
          .insert(payload)

    if (resposta.error) {
      setErro(resposta.error.message)
      setSalvando(false)
      return
    }

    setForm(formularioVazio)
    setEditando(null)
    setSalvando(false)
    carregar()
  }

  function editar(item: Colaborador) {
    setEditando(item.id)

    setForm({
      nome: item.nome,
      telefone: item.telefone || '',
      funcao: item.funcao || 'Montagem',
      especialidades: item.especialidades || '',
      possui_veiculo: item.possui_veiculo ? 'Sim' : 'Não',
      observacoes: item.observacoes || '',
      ativo: item.ativo ? 'Sim' : 'Não'
    })

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setEditando(null)
    setForm(formularioVazio)
    setErro('')
  }

  async function alterarStatus(item: Colaborador) {
    const novoStatus = !item.ativo

    const mensagem = novoStatus
      ? 'Deseja reativar este colaborador?'
      : 'Deseja desativar este colaborador?'

    if (!confirm(mensagem)) return

    const { error } = await supabase
      .from('equipe')
      .update({
        ativo: novoStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id)

    if (error) {
      setErro(error.message)
      return
    }

    carregar()
  }

  const ativos = equipe.filter(item => item.ativo).length
  const comVeiculo = equipe.filter(
    item => item.ativo && item.possui_veiculo
  ).length

  return (
    <div className="space-y-6 p-4 pb-28 md:p-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Equipe
        </h1>

        <p className="text-slate-500">
          Cadastre colaboradores e recursos disponíveis para a operação.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Colaboradores cadastrados</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {equipe.length}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Ativos</p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {ativos}
          </p>
        </Card>

        <Card>
          <p className="text-sm text-slate-500">Com veículo</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            {comVeiculo}
          </p>
        </Card>
      </div>

      <Card>
        <form onSubmit={salvar} className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editando ? 'Editar colaborador' : 'Novo colaborador'}
            </h2>

            <p className="text-sm text-slate-500">
              Informe os dados principais da pessoa que participa da operação.
            </p>
          </div>

          {erro && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Nome *"
              value={form.nome}
              onChange={evento =>
                setForm({ ...form, nome: evento.target.value })
              }
            />

            <Input
              label="Telefone / WhatsApp"
              value={form.telefone}
              onChange={evento =>
                setForm({ ...form, telefone: evento.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              label="Função principal"
              value={form.funcao}
              onChange={evento =>
                setForm({ ...form, funcao: evento.target.value })
              }
            >
              <option>Montagem</option>
              <option>Decoração</option>
              <option>Entrega</option>
              <option>Motorista</option>
              <option>Separação</option>
              <option>Conferência</option>
              <option>Atendimento</option>
              <option>Administrativo</option>
              <option>Outro</option>
            </Select>

            <Select
              label="Possui veículo?"
              value={form.possui_veiculo}
              onChange={evento =>
                setForm({
                  ...form,
                  possui_veiculo: evento.target.value
                })
              }
            >
              <option>Não</option>
              <option>Sim</option>
            </Select>

            <Select
              label="Status"
              value={form.ativo}
              onChange={evento =>
                setForm({ ...form, ativo: evento.target.value })
              }
            >
              <option>Sim</option>
              <option>Não</option>
            </Select>
          </div>

          <Input
            label="Especialidades"
            placeholder="Ex.: painel, balões, montagem, elétrica..."
            value={form.especialidades}
            onChange={evento =>
              setForm({
                ...form,
                especialidades: evento.target.value
              })
            }
          />

          <Textarea
            label="Observações"
            placeholder="Disponibilidade, região, experiência ou informações importantes..."
            value={form.observacoes}
            onChange={evento =>
              setForm({ ...form, observacoes: evento.target.value })
            }
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={salvando}>
              {salvando
                ? 'Salvando...'
                : editando
                  ? 'Salvar alterações'
                  : 'Cadastrar colaborador'}
            </Button>

            {editando && (
              <Button
                type="button"
                variant="secondary"
                onClick={cancelarEdicao}
              >
                Cancelar edição
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Colaboradores
            </h2>

            <p className="text-sm text-slate-500">
              {equipeFiltrada.length} pessoa(s) encontrada(s)
            </p>
          </div>

          <Input
            placeholder="Buscar colaborador..."
            value={busca}
            onChange={evento => setBusca(evento.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {equipeFiltrada.map(item => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 ${
                item.ativo ? 'bg-white' : 'bg-slate-50 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    {item.nome}
                  </p>

                  <p className="text-sm text-slate-500">
                    {item.funcao || 'Função não informada'}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.ativo
                      ? 'bg-green-50 text-green-700'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {item.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  <strong>Telefone:</strong> {item.telefone || '-'}
                </p>

                <p>
                  <strong>Especialidades:</strong>{' '}
                  {item.especialidades || '-'}
                </p>

                <p>
                  <strong>Veículo:</strong>{' '}
                  {item.possui_veiculo ? 'Sim' : 'Não'}
                </p>

                {item.observacoes && (
                  <p>
                    <strong>Observações:</strong> {item.observacoes}
                  </p>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => editar(item)}
                >
                  Editar
                </Button>

                <Button
                  variant={item.ativo ? 'danger' : 'secondary'}
                  onClick={() => alterarStatus(item)}
                >
                  {item.ativo ? 'Desativar' : 'Reativar'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        {equipeFiltrada.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
            Nenhum colaborador encontrado.
          </div>
        )}
      </Card>
    </div>
  )
}
