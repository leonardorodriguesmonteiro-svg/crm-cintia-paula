'use client'

import { useMemo, useState } from 'react'
import { Camera, Image as ImageIcon, Images, Trash2, Upload } from 'lucide-react'
import type { MissionViewModel } from '@/lib/application/mission/mission.types'
import { prepararFotoCatalogo } from '@/lib/catalogoFotos'
import { obterTokenSessao } from '@/lib/sessionToken'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

type EtapaEvidencia = MissionViewModel['evidencias'][number]['etapa']

const ETAPAS: Array<{ valor: EtapaEvidencia; nome: string }> = [
  { valor: 'preparacao', nome: 'Preparação' },
  { valor: 'entrega', nome: 'Entrega' },
  { valor: 'evento', nome: 'Evento' },
  { valor: 'retirada', nome: 'Retirada' },
  { valor: 'devolucao', nome: 'Devolução' }
]

function nomeEtapa(etapa: EtapaEvidencia) {
  return ETAPAS.find(item => item.valor === etapa)?.nome || etapa
}

function tamanhoArquivo(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(Math.round(bytes / 1024), 1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export function MissionEvidenceGallery({
  missaoId,
  evidencias,
  onAtualizar
}: {
  missaoId: string
  evidencias: MissionViewModel['evidencias']
  onAtualizar: () => Promise<void>
}) {
  const [etapa, setEtapa] = useState<EtapaEvidencia>('preparacao')
  const [descricao, setDescricao] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [progresso, setProgresso] = useState('')
  const [removendo, setRemovendo] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  const evidenciasPorEtapa = useMemo(() => ETAPAS.map(item => ({
    ...item,
    evidencias: evidencias.filter(evidencia => evidencia.etapa === item.valor)
  })).filter(item => item.evidencias.length > 0), [evidencias])

  function adicionarArquivos(novos: File[]) {
    setErro('')
    setSucesso('')
    setArquivos(atuais => [...atuais, ...novos].slice(0, 12))
  }

  async function enviarFotos() {
    if (!arquivos.length) {
      setErro('Tire uma foto ou escolha imagens da galeria.')
      return
    }

    setEnviando(true)
    setErro('')
    setSucesso('')
    let enviadas = 0

    try {
      const token = await obterTokenSessao()

      for (let indice = 0; indice < arquivos.length; indice += 1) {
        const original = arquivos[indice]
        setProgresso(`Preparando foto ${indice + 1} de ${arquivos.length}...`)
        const otimizada = await prepararFotoCatalogo(original)
        const formulario = new FormData()
        formulario.append('arquivo', otimizada, otimizada.name)
        formulario.append('etapa', etapa)
        formulario.append('descricao', descricao.trim())
        formulario.append('capturada_em', new Date(original.lastModified || Date.now()).toISOString())

        setProgresso(`Enviando foto ${indice + 1} de ${arquivos.length}...`)
        const resposta = await fetch(`/api/missoes/${missaoId}/evidencias`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formulario
        })
        const resultado = await resposta.json()

        if (!resposta.ok || !resultado.sucesso) {
          throw new Error(resultado.erro || `Não foi possível enviar ${original.name}.`)
        }

        enviadas += 1
      }

      setArquivos([])
      setDescricao('')
      setSucesso(`${enviadas} foto(s) adicionada(s) em ${nomeEtapa(etapa)}.`)
      await onAtualizar()
    } catch (error) {
      if (enviadas > 0) await onAtualizar()
      setErro(error instanceof Error ? error.message : 'Não foi possível enviar as fotos.')
    } finally {
      setEnviando(false)
      setProgresso('')
    }
  }

  async function removerEvidencia(evidenciaId: string) {
    if (!window.confirm('Remover esta foto da missão? O arquivo não poderá ser recuperado.')) return

    setRemovendo(evidenciaId)
    setErro('')
    setSucesso('')

    try {
      const token = await obterTokenSessao()
      const resposta = await fetch(`/api/missoes/${missaoId}/evidencias/${evidenciaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const resultado = await resposta.json()
      if (!resposta.ok || !resultado.sucesso) throw new Error(resultado.erro || 'Não foi possível remover a foto.')

      setSucesso('Foto removida da missão.')
      await onAtualizar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível remover a foto.')
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-pink-50 p-3 text-pink-700"><Images size={22} /></div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Fotos da missão</h2>
          <p className="mt-1 text-sm text-slate-500">Registre evidências por etapa. As fotos ficam protegidas e vinculadas à reserva.</p>
        </div>
      </div>

      {erro && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Select label="Etapa da missão" value={etapa} onChange={evento => setEtapa(evento.target.value as EtapaEvidencia)} disabled={enviando}>
            {ETAPAS.map(item => <option key={item.valor} value={item.valor}>{item.nome}</option>)}
          </Select>
          <Textarea label="Observação (opcional)" rows={2} maxLength={500} value={descricao} onChange={evento => setDescricao(evento.target.value)} disabled={enviando} placeholder="Ex.: Kit conferido antes de sair do depósito." />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-pink-700">
            <Camera size={19} /> Tirar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={enviando}
              onChange={evento => {
                adicionarArquivos(Array.from(evento.target.files || []))
                evento.target.value = ''
              }}
            />
          </label>
          <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
            <ImageIcon size={19} /> Escolher da galeria
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={enviando}
              onChange={evento => {
                adicionarArquivos(Array.from(evento.target.files || []))
                evento.target.value = ''
              }}
            />
          </label>
        </div>

        {arquivos.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-white p-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{arquivos.length} foto(s) pronta(s)</p>
              <p className="mt-1 truncate text-xs text-slate-500">{arquivos.map(arquivo => arquivo.name).join(', ')}</p>
            </div>
            <Button type="button" onClick={enviarFotos} disabled={enviando} className="flex w-full items-center justify-center gap-2 py-3">
              <Upload size={18} /> {enviando ? progresso || 'Enviando...' : `Enviar para ${nomeEtapa(etapa)}`}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {evidenciasPorEtapa.map(grupo => (
          <div key={grupo.valor}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{grupo.nome}</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{grupo.evidencias.length} foto(s)</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {grupo.evidencias.map(evidencia => (
                <article key={evidencia.id} className="overflow-hidden rounded-2xl border bg-white">
                  <a href={evidencia.url} target="_blank" rel="noreferrer" className="block aspect-square bg-slate-100">
                    <img src={evidencia.url} alt={`Evidência de ${grupo.nome}`} className="h-full w-full object-cover" loading="lazy" />
                  </a>
                  <div className="space-y-1 p-3">
                    <p className="text-xs font-semibold text-slate-700">{new Date(evidencia.capturadaEm).toLocaleString('pt-BR')}</p>
                    <p className="truncate text-[11px] text-slate-500">{evidencia.autor} · {tamanhoArquivo(evidencia.tamanhoBytes)}</p>
                    {evidencia.descricao && <p className="line-clamp-2 text-xs text-slate-600">{evidencia.descricao}</p>}
                    <button
                      type="button"
                      onClick={() => removerEvidencia(evidencia.id)}
                      disabled={removendo === evidencia.id}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-red-100 px-2 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
                    >
                      <Trash2 size={14} /> {removendo === evidencia.id ? 'Removendo...' : 'Remover'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}

        {evidencias.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <ImageIcon className="mx-auto text-slate-300" size={38} />
            <p className="mt-3 font-semibold text-slate-800">Nenhuma foto registrada</p>
            <p className="mt-1 text-sm text-slate-500">Comece documentando a preparação do kit.</p>
          </div>
        )}
      </div>
    </section>
  )
}
