'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, ClipboardPlus, Image as ImageIcon, Save, Upload, UserRound } from 'lucide-react'
import type { MissionViewModel } from '@/lib/application/mission/mission.types'
import { prepararFotoCatalogo } from '@/lib/catalogoFotos'
import { obterTokenSessao } from '@/lib/sessionToken'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type Ocorrencia = MissionViewModel['ocorrencias'][number]
type Responsavel = MissionViewModel['responsaveisDisponiveis'][number]
type TipoOcorrencia = Ocorrencia['tipo']
type EtapaOcorrencia = Ocorrencia['etapa']
type PrioridadeOcorrencia = Ocorrencia['prioridade']
type StatusOcorrencia = Ocorrencia['status']

const TIPOS: Array<{ valor: TipoOcorrencia; nome: string }> = [
  { valor: 'dano', nome: 'Dano ou avaria' },
  { valor: 'item_faltante', nome: 'Item faltante' },
  { valor: 'atraso', nome: 'Atraso' },
  { valor: 'outro', nome: 'Outra ocorrência' }
]

const ETAPAS: Array<{ valor: EtapaOcorrencia; nome: string }> = [
  { valor: 'preparacao', nome: 'Preparação' },
  { valor: 'entrega', nome: 'Entrega' },
  { valor: 'evento', nome: 'Evento' },
  { valor: 'retirada', nome: 'Retirada' },
  { valor: 'devolucao', nome: 'Devolução' }
]

const PRIORIDADES: Array<{ valor: PrioridadeOcorrencia; nome: string }> = [
  { valor: 'baixa', nome: 'Baixa' },
  { valor: 'media', nome: 'Média' },
  { valor: 'alta', nome: 'Alta' },
  { valor: 'critica', nome: 'Crítica' }
]

const STATUS: Array<{ valor: StatusOcorrencia; nome: string }> = [
  { valor: 'aberta', nome: 'Aberta' },
  { valor: 'em_acompanhamento', nome: 'Em acompanhamento' },
  { valor: 'resolvida', nome: 'Resolvida' }
]

function rotulo<T extends string>(itens: Array<{ valor: T; nome: string }>, valor: T) {
  return itens.find(item => item.valor === valor)?.nome || valor
}

function estiloPrioridade(prioridade: PrioridadeOcorrencia) {
  if (prioridade === 'critica') return 'bg-red-100 text-red-800'
  if (prioridade === 'alta') return 'bg-orange-100 text-orange-800'
  if (prioridade === 'media') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function estiloStatus(status: StatusOcorrencia) {
  if (status === 'resolvida') return 'bg-green-100 text-green-800'
  if (status === 'em_acompanhamento') return 'bg-blue-100 text-blue-800'
  return 'bg-pink-100 text-pink-800'
}

function OccurrenceCard({
  missaoId,
  ocorrencia,
  responsaveis,
  onAtualizar
}: {
  missaoId: string
  ocorrencia: Ocorrencia
  responsaveis: Responsavel[]
  onAtualizar: () => Promise<void>
}) {
  const [status, setStatus] = useState(ocorrencia.status)
  const [prioridade, setPrioridade] = useState(ocorrencia.prioridade)
  const [responsavelId, setResponsavelId] = useState(ocorrencia.responsavelId || '')
  const [resolucao, setResolucao] = useState(ocorrencia.resolucao || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    setStatus(ocorrencia.status)
    setPrioridade(ocorrencia.prioridade)
    setResponsavelId(ocorrencia.responsavelId || '')
    setResolucao(ocorrencia.resolucao || '')
  }, [ocorrencia])

  async function salvarAcompanhamento() {
    if (!responsavelId) return setErro('Selecione o responsável.')
    if (status === 'resolvida' && resolucao.trim().length < 5) {
      return setErro('Descreva a solução antes de resolver a ocorrência.')
    }
    if (status === 'resolvida' && !window.confirm('Confirmar a resolução desta ocorrência?')) return

    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      const token = await obterTokenSessao()
      const resposta = await fetch(`/api/missoes/${missaoId}/ocorrencias/${ocorrencia.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          prioridade,
          responsavel_usuario_id: responsavelId,
          resolucao: resolucao.trim()
        })
      })
      const resultado = await resposta.json()
      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.erro || 'Não foi possível atualizar a ocorrência.')
      }

      setSucesso('Acompanhamento atualizado.')
      await onAtualizar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível atualizar a ocorrência.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <article className="rounded-2xl border bg-white p-4 md:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${estiloStatus(ocorrencia.status)}`}>{rotulo(STATUS, ocorrencia.status)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${estiloPrioridade(ocorrencia.prioridade)}`}>{rotulo(PRIORIDADES, ocorrencia.prioridade)}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{rotulo(TIPOS, ocorrencia.tipo)}</span>
          </div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">{ocorrencia.titulo}</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{ocorrencia.descricao}</p>
        </div>
        {ocorrencia.status === 'resolvida'
          ? <CheckCircle2 className="shrink-0 text-green-600" size={27} />
          : <AlertTriangle className="shrink-0 text-amber-600" size={27} />}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
        <p><strong className="text-slate-700">Etapa:</strong> {rotulo(ETAPAS, ocorrencia.etapa)}</p>
        <p><strong className="text-slate-700">Responsável:</strong> {ocorrencia.responsavelNome}</p>
        <p><strong className="text-slate-700">Aberta em:</strong> {new Date(ocorrencia.criadaEm).toLocaleString('pt-BR')}</p>
        <p><strong className="text-slate-700">Registrada por:</strong> {ocorrencia.criadaPor}</p>
      </div>

      {ocorrencia.fotos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {ocorrencia.fotos.map(foto => (
            <a key={foto.id} href={foto.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border bg-slate-100">
              <img src={foto.url} alt={`Foto da ocorrência ${ocorrencia.titulo}`} className="h-full w-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}

      {ocorrencia.resolvidaEm && (
        <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
          <p className="font-semibold">Resolvida em {new Date(ocorrencia.resolvidaEm).toLocaleString('pt-BR')}</p>
          {ocorrencia.resolvidaPor && <p className="mt-1 text-xs">Por {ocorrencia.resolvidaPor}</p>}
        </div>
      )}

      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900"><UserRound size={17} /> Acompanhamento</h4>
        {erro && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
        {sucesso && <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{sucesso}</div>}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Select label="Status" value={status} onChange={evento => setStatus(evento.target.value as StatusOcorrencia)} disabled={salvando}>
            {STATUS.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
          </Select>
          <Select label="Prioridade" value={prioridade} onChange={evento => setPrioridade(evento.target.value as PrioridadeOcorrencia)} disabled={salvando}>
            {PRIORIDADES.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
          </Select>
          <Select label="Responsável" value={responsavelId} onChange={evento => setResponsavelId(evento.target.value)} disabled={salvando}>
            <option value="">Selecione</option>
            {responsaveis.map(item => <option key={item.id} value={item.id}>{item.nome} · {item.perfil}</option>)}
          </Select>
        </div>
        <div className="mt-3">
          <Textarea label="Acompanhamento / solução" rows={3} maxLength={2000} value={resolucao} onChange={evento => setResolucao(evento.target.value)} disabled={salvando} placeholder="Registre providências, contatos e a solução aplicada." />
        </div>
        <Button type="button" className="mt-3 flex w-full items-center justify-center gap-2 py-3" onClick={salvarAcompanhamento} disabled={salvando}>
          <Save size={17} /> {salvando ? 'Salvando...' : 'Salvar acompanhamento'}
        </Button>
      </div>
    </article>
  )
}

export function MissionOccurrences({
  missaoId,
  ocorrencias,
  responsaveis,
  onAtualizar
}: {
  missaoId: string
  ocorrencias: MissionViewModel['ocorrencias']
  responsaveis: MissionViewModel['responsaveisDisponiveis']
  onAtualizar: () => Promise<void>
}) {
  const [formAberto, setFormAberto] = useState(false)
  const [tipo, setTipo] = useState<TipoOcorrencia>('dano')
  const [etapa, setEtapa] = useState<EtapaOcorrencia>('preparacao')
  const [prioridade, setPrioridade] = useState<PrioridadeOcorrencia>('media')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [fotos, setFotos] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const resumo = useMemo(() => ({
    abertas: ocorrencias.filter(item => item.status !== 'resolvida').length,
    criticas: ocorrencias.filter(item => item.status !== 'resolvida' && item.prioridade === 'critica').length,
    resolvidas: ocorrencias.filter(item => item.status === 'resolvida').length
  }), [ocorrencias])

  function abrirFormulario() {
    setFormAberto(true)
    setResponsavelId(atual => atual || responsaveis[0]?.id || '')
    setErro('')
    setSucesso('')
  }

  function adicionarFotos(novas: File[]) {
    setFotos(atuais => [...atuais, ...novas].slice(0, 6))
    setErro('')
  }

  function limparFormulario() {
    setFormAberto(false)
    setTipo('dano')
    setEtapa('preparacao')
    setPrioridade('media')
    setTitulo('')
    setDescricao('')
    setResponsavelId('')
    setFotos([])
  }

  async function criarOcorrencia() {
    if (titulo.trim().length < 3) return setErro('Informe um título para a ocorrência.')
    if (descricao.trim().length < 5) return setErro('Descreva o que aconteceu.')
    if (!responsavelId) return setErro('Selecione o responsável pelo acompanhamento.')

    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      const token = await obterTokenSessao()
      const formulario = new FormData()
      formulario.append('tipo', tipo)
      formulario.append('etapa', etapa)
      formulario.append('prioridade', prioridade)
      formulario.append('titulo', titulo.trim())
      formulario.append('descricao', descricao.trim())
      formulario.append('responsavel_usuario_id', responsavelId)

      for (let indice = 0; indice < fotos.length; indice += 1) {
        setProgresso(`Preparando foto ${indice + 1} de ${fotos.length}...`)
        const otimizada = await prepararFotoCatalogo(fotos[indice])
        formulario.append('fotos', otimizada, otimizada.name)
      }

      setProgresso('Registrando ocorrência...')
      const resposta = await fetch(`/api/missoes/${missaoId}/ocorrencias`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formulario
      })
      const resultado = await resposta.json()
      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.erro || 'Não foi possível registrar a ocorrência.')
      }

      limparFormulario()
      setSucesso('Ocorrência registrada e encaminhada para acompanhamento.')
      await onAtualizar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar a ocorrência.')
    } finally {
      setSalvando(false)
      setProgresso('')
    }
  }

  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><AlertTriangle size={22} /></div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Ocorrências da missão</h2>
            <p className="mt-1 text-sm text-slate-500">Documente problemas, defina responsáveis e acompanhe a solução.</p>
          </div>
        </div>
        <Button type="button" className="flex items-center justify-center gap-2 py-3" onClick={abrirFormulario} disabled={formAberto}>
          <ClipboardPlus size={18} /> Nova ocorrência
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-pink-50 p-3"><p className="text-xl font-bold text-pink-700">{resumo.abertas}</p><p className="text-xs text-pink-700">Em aberto</p></div>
        <div className="rounded-xl bg-red-50 p-3"><p className="text-xl font-bold text-red-700">{resumo.criticas}</p><p className="text-xs text-red-700">Críticas</p></div>
        <div className="rounded-xl bg-green-50 p-3"><p className="text-xl font-bold text-green-700">{resumo.resolvidas}</p><p className="text-xs text-green-700">Resolvidas</p></div>
      </div>

      {erro && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      {formAberto && (
        <div className="mt-5 rounded-2xl border-2 border-amber-100 bg-amber-50/40 p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-bold text-slate-900">Registrar ocorrência</h3>
            <button type="button" className="text-sm font-semibold text-slate-500" onClick={limparFormulario} disabled={salvando}>Cancelar</button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Select label="Tipo" value={tipo} onChange={evento => setTipo(evento.target.value as TipoOcorrencia)} disabled={salvando}>
              {TIPOS.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
            </Select>
            <Select label="Etapa" value={etapa} onChange={evento => setEtapa(evento.target.value as EtapaOcorrencia)} disabled={salvando}>
              {ETAPAS.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
            </Select>
            <Select label="Prioridade" value={prioridade} onChange={evento => setPrioridade(evento.target.value as PrioridadeOcorrencia)} disabled={salvando}>
              {PRIORIDADES.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
            </Select>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input label="Título" value={titulo} onChange={evento => setTitulo(evento.target.value)} maxLength={160} disabled={salvando} placeholder="Ex.: Bandeja chegou danificada" />
            <Select label="Responsável" value={responsavelId} onChange={evento => setResponsavelId(evento.target.value)} disabled={salvando}>
              <option value="">Selecione</option>
              {responsaveis.map(item => <option key={item.id} value={item.id}>{item.nome} · {item.perfil}</option>)}
            </Select>
          </div>

          <div className="mt-3">
            <Textarea label="Descrição" rows={4} maxLength={2000} value={descricao} onChange={evento => setDescricao(evento.target.value)} disabled={salvando} placeholder="Informe o item, o dano, o local e demais detalhes importantes." />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700">
              <Camera size={18} /> Tirar foto
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={salvando} onChange={evento => { adicionarFotos(Array.from(evento.target.files || [])); evento.target.value = '' }} />
            </label>
            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <ImageIcon size={18} /> Escolher fotos
              <input type="file" accept="image/*" multiple className="hidden" disabled={salvando} onChange={evento => { adicionarFotos(Array.from(evento.target.files || [])); evento.target.value = '' }} />
            </label>
          </div>

          {fotos.length > 0 && <p className="mt-3 truncate rounded-xl bg-white p-3 text-xs text-slate-500">{fotos.length} foto(s): {fotos.map(foto => foto.name).join(', ')}</p>}

          <Button type="button" className="mt-4 flex w-full items-center justify-center gap-2 py-3" onClick={criarOcorrencia} disabled={salvando}>
            {salvando ? <Upload size={17} /> : <ClipboardPlus size={17} />} {salvando ? progresso || 'Registrando...' : 'Registrar ocorrência'}
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {ocorrencias.map(ocorrencia => (
          <OccurrenceCard key={ocorrencia.id} missaoId={missaoId} ocorrencia={ocorrencia} responsaveis={responsaveis} onAtualizar={onAtualizar} />
        ))}

        {ocorrencias.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <CheckCircle2 className="mx-auto text-green-400" size={38} />
            <p className="mt-3 font-semibold text-slate-800">Nenhuma ocorrência registrada</p>
            <p className="mt-1 text-sm text-slate-500">A missão está sem danos, faltas ou atrasos documentados.</p>
          </div>
        )}
      </div>
    </section>
  )
}
