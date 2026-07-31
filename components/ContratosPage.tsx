'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, FileSignature } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'

type Contrato = {
  id: string
  reserva_id: string | null
  numero_contrato: string
  status: string | null
  public_token: string | null
  assinado_em: string | null
  assinado_por: string | null
  created_at: string | null
  reservas: {
    data_evento: string | null
    valor_total: number | null
    clientes: { nome: string } | null
    kits: { nome: string } | null
  } | null
}

function moeda(valor: number | null) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function corStatus(status: string | null) {
  if (status === 'Assinado') return 'bg-green-100 text-green-800'
  if (status === 'Enviado') return 'bg-blue-100 text-blue-800'
  if (status === 'Cancelado') return 'bg-red-100 text-red-800'
  return 'bg-amber-100 text-amber-800'
}

export function ContratosPage() {
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  async function carregar() {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase
      .from('contratos')
      .select('id,reserva_id,numero_contrato,status,public_token,assinado_em,assinado_por,created_at,reservas(data_evento,valor_total,clientes(nome),kits(nome))')
      .order('created_at', { ascending: false })

    if (error) setErro(error.message)
    else setContratos((data as unknown as Contrato[]) || [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const pendentes = contratos.filter(item => item.status !== 'Assinado' && item.status !== 'Cancelado').length

  async function copiarLink(contrato: Contrato) {
    if (!contrato.public_token) return
    const link = `${window.location.origin}/contrato/${contrato.public_token}`
    let copiaConcluida = false

    try {
      await navigator.clipboard.writeText(link)
      copiaConcluida = true
    } catch {
      const campo = document.createElement('textarea')
      campo.value = link
      campo.setAttribute('readonly', '')
      campo.style.position = 'fixed'
      campo.style.opacity = '0'
      document.body.appendChild(campo)
      campo.select()
      campo.setSelectionRange(0, campo.value.length)
      copiaConcluida = document.execCommand('copy')
      document.body.removeChild(campo)
    }

    if (copiaConcluida) {
      setErro('')
      setCopiadoId(contrato.id)
      window.setTimeout(() => setCopiadoId(null), 2500)
    } else {
      setErro('Não foi possível copiar o link. Abra a página de assinatura e copie o endereço.')
    }
  }

  return (
    <div className="space-y-6 p-4 pb-28 md:p-8">
      <div>
        <p className="text-sm font-semibold text-pink-700">COMERCIAL</p>
        <h1 className="text-3xl font-bold text-slate-900">Contratos</h1>
        <p className="mt-1 text-slate-500">Acompanhe os documentos gerados durante a formalização das vendas.</p>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card><p className="text-sm text-slate-500">Contratos gerados</p><p className="mt-2 text-3xl font-bold text-slate-900">{contratos.length}</p></Card>
        <Card><p className="text-sm text-slate-500">Aguardando assinatura</p><p className="mt-2 text-3xl font-bold text-amber-700">{pendentes}</p></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contratos.map(contrato => (
          <Card key={contrato.id}>
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-pink-700">{contrato.numero_contrato}</p><h2 className="font-bold text-slate-900">{contrato.reservas?.clientes?.nome || 'Cliente'}</h2></div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${corStatus(contrato.status)}`}>{contrato.status || 'Gerado'}</span>
            </div>
            <div className="mt-4 space-y-1 text-sm text-slate-500">
              <p>Kit: {contrato.reservas?.kits?.nome || '-'}</p>
              <p>Evento: {contrato.reservas?.data_evento ? new Date(`${contrato.reservas.data_evento}T12:00:00`).toLocaleDateString('pt-BR') : '-'}</p>
              {contrato.assinado_em && <p>Assinado em {new Date(contrato.assinado_em).toLocaleString('pt-BR')}{contrato.assinado_por ? ` por ${contrato.assinado_por}` : ''}</p>}
              <p className="pt-2 text-lg font-bold text-slate-900">{moeda(contrato.reservas?.valor_total || 0)}</p>
            </div>
            <div className="mt-4 grid gap-2">
              {contrato.public_token && contrato.status !== 'Assinado' && <button type="button" onClick={() => copiarLink(contrato)} className="flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-700">{copiadoId === contrato.id ? <Check size={16} /> : <Copy size={16} />} {copiadoId === contrato.id ? 'Link copiado' : 'Copiar link de assinatura'}</button>}
              {contrato.public_token && <a href={`/contrato/${contrato.public_token}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-semibold text-pink-700 hover:bg-pink-100"><FileSignature size={16} /> Abrir página do cliente</a>}
              <a href={`/contratos/${contrato.id}/imprimir`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileSignature size={16} /> Abrir versão para impressão</a>
              {contrato.reserva_id && <Link href={`/reservas/${contrato.reserva_id}`} className="flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink size={16} /> Abrir reserva</Link>}
            </div>
          </Card>
        ))}
      </div>

      {!carregando && contratos.length === 0 && <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-slate-500">Nenhum contrato gerado.</div>}
      {carregando && <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">Carregando contratos...</div>}
    </div>
  )
}
