'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Bot,
  CalendarDays,
  Eye,
  FileClock,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X
} from 'lucide-react'
import { useAcesso } from '@/components/auth/AcessoContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'

type ValorJson = string | number | boolean | null | ValorJson[] | { [chave: string]: ValorJson }

type LogAuditoria = {
  id: string
  empresa_id: string
  usuario_id: string | null
  entidade: string
  entidade_id: string | null
  acao: string
  dados_anteriores: Record<string, ValorJson> | null
  dados_novos: Record<string, ValorJson> | null
  created_at: string
}

type UsuarioAuditoria = {
  usuario_id: string
  nome: string
  perfil: string
}

type Alteracao = {
  campo: string
  anterior: ValorJson | undefined
  novo: ValorJson | undefined
}

const entidades: Record<string, string> = {
  empresas: 'Empresa',
  usuarios_empresa: 'Usuários e acessos',
  clientes: 'Clientes',
  estoque_itens: 'Estoque',
  kits: 'Kits',
  kit_composicao: 'Composição dos kits',
  reservas: 'Reservas',
  reserva_itens: 'Itens da reserva',
  oportunidades: 'Funil comercial',
  orcamentos: 'Orçamentos',
  orcamento_itens: 'Itens do orçamento',
  contratos: 'Contratos',
  lancamentos_financeiros: 'Lançamentos financeiros',
  recebimentos: 'Recebimentos',
  feedbacks: 'Feedbacks',
  configuracoes_pagamento: 'Configurações de pagamento',
  ordens_servico: 'Ordens de serviço',
  ordem_servico_itens: 'Itens da ordem de serviço',
  equipe: 'Equipe',
  ordem_servico_equipe: 'Equipe da ordem de serviço',
  reserva_checklist: 'Checklist da reserva',
  reserva_logistica: 'Logística da reserva',
  conferencias: 'Conferências',
  conferencia_itens: 'Itens da conferência',
  movimentos_estoque: 'Movimentações de estoque',
  despesas: 'Despesas'
}

const camposIgnorados = new Set([
  'created_at',
  'updated_at',
  'updated_by',
  'empresa_id'
])

const nomesCampos: Record<string, string> = {
  id: 'Identificador',
  nome: 'Nome',
  nome_fantasia: 'Nome fantasia',
  razao_social: 'Razão social',
  codigo: 'Código',
  descricao: 'Descrição',
  status: 'Status',
  ativo: 'Acesso ativo',
  perfil: 'Perfil',
  email: 'E-mail',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  etapa: 'Etapa',
  prioridade: 'Prioridade',
  resposta: 'Resposta',
  valor: 'Valor',
  valor_total: 'Valor total',
  valor_sinal: 'Valor do sinal',
  quantidade: 'Quantidade',
  quantidade_total: 'Quantidade total',
  quantidade_manutencao: 'Quantidade em manutenção',
  data_evento: 'Data do evento',
  data_inicio: 'Data de início',
  data_fim: 'Data de término',
  forma_pagamento: 'Forma de pagamento',
  pago: 'Pagamento confirmado',
  assinado: 'Contrato assinado',
  observacoes: 'Observações',
  mensagem: 'Mensagem',
  pagina: 'Página',
  pix_chave: 'Chave Pix',
  link_pagamento: 'Link de pagamento'
}

function nomeEntidade(valor: string) {
  return entidades[valor] || valor.replaceAll('_', ' ')
}

function acaoNormalizada(valor: string) {
  const acao = valor.toUpperCase()
  if (acao.includes('ATUALIZA') || acao === 'UPDATE') return 'ATUALIZAR'
  if (acao === 'INSERT') return 'CRIAR'
  if (acao === 'DELETE') return 'EXCLUIR'
  return acao
}

function dataHora(valor: string) {
  return new Date(valor).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

function mesmoValor(a: ValorJson | undefined, b: ValorJson | undefined) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function alteracoesDoLog(log: LogAuditoria): Alteracao[] {
  const anterior = log.dados_anteriores || {}
  const novo = log.dados_novos || {}
  const chaves = Array.from(new Set([...Object.keys(anterior), ...Object.keys(novo)]))

  return chaves
    .filter(campo => !camposIgnorados.has(campo))
    .filter(campo => !mesmoValor(anterior[campo], novo[campo]))
    .sort((a, b) => (nomesCampos[a] || a).localeCompare(nomesCampos[b] || b, 'pt-BR'))
    .map(campo => ({ campo, anterior: anterior[campo], novo: novo[campo] }))
}

function formatarValor(valor: ValorJson | undefined) {
  if (valor === undefined || valor === null || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (typeof valor === 'number') return String(valor)
  if (typeof valor === 'object') return JSON.stringify(valor, null, 2)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) {
    const data = new Date(valor)
    if (!Number.isNaN(data.getTime())) return data.toLocaleString('pt-BR')
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
  }
  return valor
}

function corAcao(acao: string) {
  if (acao === 'CRIAR') return 'bg-green-100 text-green-800'
  if (acao === 'EXCLUIR') return 'bg-red-100 text-red-800'
  return 'bg-sky-100 text-sky-800'
}

export function AuditoriaAdminPage() {
  const { acesso } = useAcesso()
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [usuarios, setUsuarios] = useState<Record<string, UsuarioAuditoria>>({})
  const [busca, setBusca] = useState('')
  const [filtroEntidade, setFiltroEntidade] = useState('Todas')
  const [filtroAcao, setFiltroAcao] = useState('Todas')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [limite, setLimite] = useState(100)
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [selecionado, setSelecionado] = useState<LogAuditoria | null>(null)

  async function carregar() {
    if (!acesso?.empresa_id) return
    setCarregando(true)
    setErro('')

    const [logsResposta, usuariosResposta] = await Promise.all([
      supabase
        .from('auditoria_logs')
        .select('id,empresa_id,usuario_id,entidade,entidade_id,acao,dados_anteriores,dados_novos,created_at', { count: 'exact' })
        .eq('empresa_id', acesso.empresa_id)
        .order('created_at', { ascending: false })
        .limit(limite),
      supabase
        .from('usuarios_empresa')
        .select('usuario_id,nome,perfil')
        .eq('empresa_id', acesso.empresa_id)
    ])

    if (logsResposta.error) {
      setErro(logsResposta.error.message)
      setLogs([])
    } else {
      setLogs((logsResposta.data || []) as LogAuditoria[])
      setTotal(logsResposta.count || 0)
    }

    if (!usuariosResposta.error) {
      const mapa = Object.fromEntries(
        (usuariosResposta.data || []).map(usuario => [usuario.usuario_id, usuario])
      )
      setUsuarios(mapa)
    }
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [acesso?.empresa_id, limite])

  const entidadesDisponiveis = useMemo(() => (
    Array.from(new Set(logs.map(log => log.entidade)))
      .sort((a, b) => nomeEntidade(a).localeCompare(nomeEntidade(b), 'pt-BR'))
  ), [logs])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const inicioMs = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : null
    const fimMs = dataFim ? new Date(`${dataFim}T23:59:59.999`).getTime() : null

    return logs.filter(log => {
      const usuario = log.usuario_id ? usuarios[log.usuario_id] : null
      const dataLogMs = new Date(log.created_at).getTime()
      const correspondeBusca = !termo || [
        nomeEntidade(log.entidade),
        log.entidade_id,
        acaoNormalizada(log.acao),
        usuario?.nome,
        usuario?.perfil,
        JSON.stringify(log.dados_anteriores),
        JSON.stringify(log.dados_novos)
      ].filter(Boolean).join(' ').toLowerCase().includes(termo)

      return correspondeBusca
        && (filtroEntidade === 'Todas' || log.entidade === filtroEntidade)
        && (filtroAcao === 'Todas' || acaoNormalizada(log.acao) === filtroAcao)
        && (inicioMs === null || dataLogMs >= inicioMs)
        && (fimMs === null || dataLogMs <= fimMs)
    })
  }, [logs, usuarios, busca, filtroEntidade, filtroAcao, dataInicio, dataFim])

  const resumo = useMemo(() => {
    const hoje = new Date().toLocaleDateString('en-CA')
    return {
      exibidos: filtrados.length,
      hoje: logs.filter(log => new Date(log.created_at).toLocaleDateString('en-CA') === hoje).length,
      usuarios: new Set(logs.filter(log => log.usuario_id).map(log => log.usuario_id)).size,
      sistema: logs.filter(log => !log.usuario_id).length
    }
  }, [logs, filtrados])

  function limparFiltros() {
    setBusca('')
    setFiltroEntidade('Todas')
    setFiltroAcao('Todas')
    setDataInicio('')
    setDataFim('')
  }

  return (
    <div className="space-y-6 p-4 pb-28 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p>
          <h1 className="text-3xl font-bold text-slate-900">Logs e auditoria</h1>
          <p className="mt-1 text-slate-500">Acompanhe quem alterou, quando alterou e o que foi modificado no ERP.</p>
        </div>
        <Button type="button" variant="secondary" onClick={carregar} disabled={carregando} className="flex items-center justify-center gap-2">
          <RefreshCw size={17} className={carregando ? 'animate-spin' : ''} /> Atualizar
        </Button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><div className="flex items-center gap-3"><div className="rounded-2xl bg-pink-50 p-3 text-pink-700"><FileClock size={21} /></div><div><p className="text-2xl font-bold text-slate-900">{resumo.exibidos}</p><p className="text-sm text-slate-500">Registros exibidos</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><div className="rounded-2xl bg-sky-50 p-3 text-sky-700"><CalendarDays size={21} /></div><div><p className="text-2xl font-bold text-slate-900">{resumo.hoje}</p><p className="text-sm text-slate-500">Alterações hoje</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><div className="rounded-2xl bg-violet-50 p-3 text-violet-700"><UserRound size={21} /></div><div><p className="text-2xl font-bold text-slate-900">{resumo.usuarios}</p><p className="text-sm text-slate-500">Usuários identificados</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><div className="rounded-2xl bg-slate-100 p-3 text-slate-700"><Bot size={21} /></div><div><p className="text-2xl font-bold text-slate-900">{resumo.sistema}</p><p className="text-sm text-slate-500">Ações automáticas</p></div></div></Card>
      </div>

      <Card>
        <div className="flex items-start gap-3"><div className="rounded-2xl bg-pink-50 p-3 text-pink-700"><Search size={20} /></div><div><h2 className="font-bold text-slate-900">Localizar alterações</h2><p className="text-sm text-slate-500">Combine os filtros para investigar um evento específico.</p></div></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Input label="Busca" placeholder="Usuário, módulo ou conteúdo" value={busca} onChange={evento => setBusca(evento.target.value)} />
          <Select label="Módulo" value={filtroEntidade} onChange={evento => setFiltroEntidade(evento.target.value)}>
            <option value="Todas">Todos os módulos</option>
            {entidadesDisponiveis.map(entidade => <option key={entidade} value={entidade}>{nomeEntidade(entidade)}</option>)}
          </Select>
          <Select label="Ação" value={filtroAcao} onChange={evento => setFiltroAcao(evento.target.value)}>
            <option value="Todas">Todas as ações</option>
            <option value="CRIAR">Criação</option>
            <option value="ATUALIZAR">Atualização</option>
            <option value="EXCLUIR">Exclusão</option>
          </Select>
          <Input label="Data inicial" type="date" value={dataInicio} onChange={evento => setDataInicio(evento.target.value)} />
          <Input label="Data final" type="date" value={dataFim} onChange={evento => setDataFim(evento.target.value)} />
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={limparFiltros} className="text-sm font-semibold text-slate-500 hover:text-pink-700">Limpar filtros</button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-2 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-900">Histórico de alterações</h2><p className="text-sm text-slate-500">{total} registro{total === 1 ? '' : 's'} no histórico</p></div>
          <div className="flex items-center gap-2 text-xs font-medium text-green-700"><ShieldCheck size={16} /> Visível somente para administradores</div>
        </div>

        {carregando && logs.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Carregando histórico...</div>
        ) : filtrados.length === 0 ? (
          <div className="p-10 text-center"><Activity className="mx-auto text-slate-300" size={36} /><p className="mt-3 font-semibold text-slate-700">Nenhuma alteração encontrada</p><p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou aguarde novas atividades no ERP.</p></div>
        ) : (
          <div className="divide-y">
            {filtrados.map(log => {
              const acao = acaoNormalizada(log.acao)
              const usuario = log.usuario_id ? usuarios[log.usuario_id] : null
              const alteracoes = alteracoesDoLog(log)

              return (
                <div key={log.id} className="grid gap-4 p-5 transition hover:bg-slate-50 lg:grid-cols-[180px,1fr,220px,120px] lg:items-center">
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${corAcao(acao)}`}>{acao === 'CRIAR' ? 'Criação' : acao === 'EXCLUIR' ? 'Exclusão' : 'Atualização'}</span>
                    <p className="mt-2 text-xs text-slate-500">{dataHora(log.created_at)}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{nomeEntidade(log.entidade)}</p>
                    <p className="mt-1 text-sm text-slate-500">{alteracoes.length} campo{alteracoes.length === 1 ? '' : 's'} alterado{alteracoes.length === 1 ? '' : 's'}{log.entidade_id ? ` · ID ${log.entidade_id.slice(0, 8)}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2 ${usuario ? 'bg-violet-50 text-violet-700' : 'bg-slate-100 text-slate-600'}`}>{usuario ? <UserRound size={18} /> : <Bot size={18} />}</div>
                    <div><p className="text-sm font-semibold text-slate-800">{usuario?.nome || 'Sistema / Automação'}</p><p className="text-xs text-slate-500">{usuario?.perfil || 'Rotina do servidor'}</p></div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setSelecionado(log)} className="flex items-center justify-center gap-2"><Eye size={16} /> Detalhes</Button>
                </div>
              )
            })}
          </div>
        )}

        {logs.length < total && (
          <div className="border-t p-4 text-center">
            <Button type="button" variant="secondary" disabled={carregando} onClick={() => setLimite(atual => atual + 100)}>{carregando ? 'Carregando...' : 'Carregar mais 100 registros'}</Button>
          </div>
        )}
      </Card>

      {selecionado && (() => {
        const acao = acaoNormalizada(selecionado.acao)
        const usuario = selecionado.usuario_id ? usuarios[selecionado.usuario_id] : null
        const alteracoes = alteracoesDoLog(selecionado)
        return (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-5" onMouseDown={evento => { if (evento.target === evento.currentTarget) setSelecionado(null) }}>
            <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
              <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-5 py-5 sm:px-7">
                <div><p className="text-sm font-semibold text-pink-700">DETALHES DA AUDITORIA</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{nomeEntidade(selecionado.entidade)}</h2><p className="mt-1 text-sm text-slate-500">{dataHora(selecionado.created_at)} · {usuario?.nome || 'Sistema / Automação'}</p></div>
                <button type="button" aria-label="Fechar detalhes" onClick={() => setSelecionado(null)} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-50"><X size={20} /></button>
              </div>
              <div className="space-y-5 p-5 sm:p-7">
                <div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${corAcao(acao)}`}>{acao}</span>{selecionado.entidade_id && <span className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs text-slate-600">ID {selecionado.entidade_id}</span>}</div>
                {alteracoes.length === 0 ? <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">O registro histórico não contém campos de negócio diferentes para exibir.</div> : (
                  <div className="space-y-3">
                    {alteracoes.map(item => (
                      <div key={item.campo} className="overflow-hidden rounded-2xl border">
                        <div className="border-b bg-slate-50 px-4 py-3"><p className="font-semibold text-slate-800">{nomesCampos[item.campo] || item.campo.replaceAll('_', ' ')}</p></div>
                        <div className="grid md:grid-cols-2">
                          {acao !== 'CRIAR' && <div className="border-b p-4 md:border-b-0 md:border-r"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Antes</p><pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-600">{formatarValor(item.anterior)}</pre></div>}
                          {acao !== 'EXCLUIR' && <div className="p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-green-600">Depois</p><pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800">{formatarValor(item.novo)}</pre></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
