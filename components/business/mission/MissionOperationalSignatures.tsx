'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Eraser, FileSignature, PenLine, ShieldCheck } from 'lucide-react'
import type { MissionViewModel } from '@/lib/application/mission/mission.types'
import { obterTokenSessao } from '@/lib/sessionToken'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type EtapaAssinatura = MissionViewModel['assinaturas'][number]['etapa']

const ETAPAS: Array<{ valor: EtapaAssinatura; nome: string; descricao: string }> = [
  {
    valor: 'entrega',
    nome: 'Entrega ao cliente',
    descricao: 'Confirma o recebimento do kit no local do evento.'
  },
  {
    valor: 'retirada',
    nome: 'Retirada do kit',
    descricao: 'Confirma a devolução do kit para a equipe operacional.'
  }
]

export function MissionOperationalSignatures({
  missaoId,
  cliente,
  assinaturas,
  onAtualizar
}: {
  missaoId: string
  cliente: string
  assinaturas: MissionViewModel['assinaturas']
  onAtualizar: () => Promise<void>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const desenhandoRef = useRef(false)
  const pontosRef = useRef(0)
  const [etapaSelecionada, setEtapaSelecionada] = useState<EtapaAssinatura | null>(null)
  const [nomeAssinante, setNomeAssinante] = useState('')
  const [possuiTraco, setPossuiTraco] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  function limparAssinatura() {
    const canvas = canvasRef.current
    const contexto = canvas?.getContext('2d')
    if (canvas && contexto) contexto.clearRect(0, 0, canvas.width, canvas.height)
    pontosRef.current = 0
    setPossuiTraco(false)
  }

  useEffect(() => {
    if (etapaSelecionada) limparAssinatura()
  }, [etapaSelecionada])

  function abrirAssinatura(etapa: EtapaAssinatura) {
    setEtapaSelecionada(etapa)
    setNomeAssinante(cliente === 'Cliente não informado' ? '' : cliente)
    setErro('')
    setSucesso('')
  }

  function coordenadas(evento: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = evento.currentTarget
    const area = canvas.getBoundingClientRect()
    return {
      x: (evento.clientX - area.left) * (canvas.width / area.width),
      y: (evento.clientY - area.top) * (canvas.height / area.height)
    }
  }

  function iniciarTraco(evento: React.PointerEvent<HTMLCanvasElement>) {
    const contexto = evento.currentTarget.getContext('2d')
    if (!contexto || salvando) return

    const ponto = coordenadas(evento)
    evento.currentTarget.setPointerCapture(evento.pointerId)
    contexto.beginPath()
    contexto.moveTo(ponto.x, ponto.y)
    contexto.lineCap = 'round'
    contexto.lineJoin = 'round'
    contexto.lineWidth = 4
    contexto.strokeStyle = '#0f172a'
    desenhandoRef.current = true
    pontosRef.current = 1
  }

  function continuarTraco(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhandoRef.current) return
    const contexto = evento.currentTarget.getContext('2d')
    if (!contexto) return

    const ponto = coordenadas(evento)
    contexto.lineTo(ponto.x, ponto.y)
    contexto.stroke()
    pontosRef.current += 1
    if (pontosRef.current === 4) setPossuiTraco(true)
  }

  function finalizarTraco(evento: React.PointerEvent<HTMLCanvasElement>) {
    desenhandoRef.current = false
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture(evento.pointerId)
    }
  }

  async function imagemAssinatura() {
    const canvas = canvasRef.current
    if (!canvas) throw new Error('A área de assinatura não está disponível.')

    const final = document.createElement('canvas')
    final.width = canvas.width
    final.height = canvas.height
    const contexto = final.getContext('2d')
    if (!contexto) throw new Error('Não foi possível preparar a assinatura.')

    contexto.fillStyle = '#ffffff'
    contexto.fillRect(0, 0, final.width, final.height)
    contexto.drawImage(canvas, 0, 0)

    const blob = await new Promise<Blob | null>(resolve => final.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Não foi possível gerar a imagem da assinatura.')
    return new File([blob], `assinatura-${etapaSelecionada}.png`, { type: 'image/png' })
  }

  async function registrarAssinatura() {
    if (!etapaSelecionada) return
    if (nomeAssinante.trim().length < 2) {
      setErro('Informe o nome de quem está assinando.')
      return
    }
    if (!possuiTraco) {
      setErro('Peça ao cliente para assinar na área indicada.')
      return
    }
    if (!window.confirm('Confirmar esta assinatura? Após o registro ela será preservada na missão.')) return

    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      const token = await obterTokenSessao()
      const formulario = new FormData()
      formulario.append('assinatura', await imagemAssinatura())
      formulario.append('etapa', etapaSelecionada)
      formulario.append('nome_assinante', nomeAssinante.trim())

      const resposta = await fetch(`/api/missoes/${missaoId}/assinaturas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formulario
      })
      const resultado = await resposta.json()

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.erro || 'Não foi possível registrar a assinatura.')
      }

      const etapaConcluida = etapaSelecionada
      setEtapaSelecionada(null)
      setNomeAssinante('')
      setSucesso(`Assinatura da ${etapaConcluida} registrada com sucesso.`)
      await onAtualizar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível registrar a assinatura.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="rounded-3xl border bg-white p-5 md:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700"><FileSignature size={22} /></div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Assinaturas operacionais</h2>
          <p className="mt-1 text-sm text-slate-500">Registre o aceite do cliente na entrega e na retirada do kit.</p>
        </div>
      </div>

      {erro && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {ETAPAS.map(etapa => {
          const assinatura = assinaturas.find(item => item.etapa === etapa.valor)

          return (
            <article key={etapa.valor} className={`rounded-2xl border p-4 ${assinatura ? 'border-green-200 bg-green-50/50' : 'bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{etapa.nome}</h3>
                  <p className="mt-1 text-sm text-slate-500">{etapa.descricao}</p>
                </div>
                {assinatura
                  ? <CheckCircle2 className="shrink-0 text-green-600" size={24} />
                  : <PenLine className="shrink-0 text-slate-400" size={22} />}
              </div>

              {assinatura ? (
                <div className="mt-4 space-y-3">
                  <a href={assinatura.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-white">
                    <img src={assinatura.url} alt={`Assinatura da ${etapa.nome}`} className="h-28 w-full object-contain" />
                  </a>
                  <div className="text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">{assinatura.nomeAssinante}</p>
                    <p>{new Date(assinatura.assinadaEm).toLocaleString('pt-BR')}</p>
                    <p className="mt-1 text-xs text-slate-500">Registrada por {assinatura.registradaPor}</p>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-green-100/70 p-3 text-xs text-green-800">
                    <ShieldCheck className="mt-0.5 shrink-0" size={16} />
                    <p>Registro preservado na missão e vinculado à Timeline.</p>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="secondary" className="mt-4 flex w-full items-center justify-center gap-2 py-3" onClick={() => abrirAssinatura(etapa.valor)}>
                  <FileSignature size={17} /> Registrar assinatura
                </Button>
              )}
            </article>
          )
        })}
      </div>

      {etapaSelecionada && (
        <div className="mt-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50/40 p-4 md:p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Nova assinatura</p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{ETAPAS.find(item => item.valor === etapaSelecionada)?.nome}</h3>
            </div>
            <button type="button" className="text-left text-sm font-semibold text-slate-500 sm:text-right" onClick={() => setEtapaSelecionada(null)} disabled={salvando}>Cancelar</button>
          </div>

          <div className="mt-4">
            <Input label="Nome de quem está assinando" value={nomeAssinante} onChange={evento => setNomeAssinante(evento.target.value)} maxLength={120} disabled={salvando} autoComplete="name" />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-700">Assine abaixo</p>
              <button type="button" onClick={limparAssinatura} disabled={salvando} className="flex items-center gap-1 text-xs font-semibold text-slate-500 disabled:opacity-50"><Eraser size={14} /> Limpar</button>
            </div>
            <canvas
              ref={canvasRef}
              width={900}
              height={260}
              aria-label="Área para assinatura"
              className="h-48 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white shadow-inner"
              onPointerDown={iniciarTraco}
              onPointerMove={continuarTraco}
              onPointerUp={finalizarTraco}
              onPointerCancel={finalizarTraco}
              onPointerLeave={evento => {
                if (desenhandoRef.current) continuarTraco(evento)
              }}
            />
            <p className="mt-2 text-xs text-slate-500">Use o dedo no celular ou o mouse no computador.</p>
          </div>

          <Button type="button" className="mt-4 flex w-full items-center justify-center gap-2 py-3" onClick={registrarAssinatura} disabled={salvando}>
            <ShieldCheck size={18} /> {salvando ? 'Registrando assinatura...' : 'Confirmar e registrar'}
          </Button>
        </div>
      )}
    </section>
  )
}
