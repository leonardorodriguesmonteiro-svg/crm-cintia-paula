'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, CreditCard, ExternalLink, FileClock, ShieldCheck, UserCog, Webhook } from 'lucide-react'
import { Card } from '@/components/ui/Card'

type StatusMercadoPago = {
  access_token_configurado: boolean
  webhook_secret_configurado: boolean
  pronto: boolean
  webhook_url: string
}

export function ConfiguracoesPage() {
  const [mercadoPago, setMercadoPago] = useState<StatusMercadoPago | null>(null)

  async function carregar() {
    try {
      const resposta = await fetch('/api/pagamentos/mercado-pago/status', { cache: 'no-store' })
      if (resposta.ok) setMercadoPago(await resposta.json())
    } catch {
      setMercadoPago(null)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-2 text-slate-500">Administração e preferências do ERP.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Link
          href="/configuracoes/empresa"
          className="rounded-3xl border bg-white p-6 transition hover:border-pink-200 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 size={19} /> Dados da empresa</h2>
          <p className="mt-1 text-sm text-slate-500">Logo, cadastro fiscal, endereço, PIX e contrato padrão.</p>
        </Link>

        <Link
          href="/administracao/usuarios"
          className="rounded-3xl border bg-white p-6 transition hover:border-pink-200 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900"><UserCog size={19} /> Usuários e acessos</h2>
          <p className="mt-1 text-sm text-slate-500">Convide usuários, altere perfis e desative acessos.</p>
        </Link>

        <Link
          href="/administracao/feedbacks"
          className="rounded-3xl border bg-white p-6 transition hover:border-pink-200 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p>
          <h2 className="mt-2 text-lg font-bold text-slate-900">Central de Feedback</h2>
          <p className="mt-1 text-sm text-slate-500">
            Consulte, classifique e responda sugestões enviadas pelo ERP.
          </p>
        </Link>

        <Link
          href="/administracao/auditoria"
          className="rounded-3xl border bg-white p-6 transition hover:border-pink-200 hover:shadow-sm"
        >
          <p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900"><FileClock size={19} /> Logs e auditoria</h2>
          <p className="mt-1 text-sm text-slate-500">Veja quem alterou, quando alterou e quais dados mudaram.</p>
        </Link>

        <div className="rounded-3xl border bg-white p-6">
          <p className="text-sm font-semibold text-pink-700">COMERCIAL</p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-slate-900"><CreditCard size={19} /> Assinatura e sinal</h2>
          <p className="mt-1 text-sm text-slate-500">Dados exibidos ao cliente depois da assinatura digital.</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-pink-50 p-3 text-pink-700"><CreditCard size={22} /></div>
            <div><h2 className="text-xl font-bold text-slate-900">Recebimento do sinal</h2><p className="mt-1 text-sm text-slate-500">O PIX, o link de pagamento e as orientações ao cliente agora ficam centralizados nos dados da empresa.</p></div>
          </div>
          <Link href="/configuracoes/empresa#pagamentos" className="shrink-0 rounded-xl bg-pink-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-pink-700">Configurar recebimento</Link>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-sky-50 p-3 text-sky-700"><ShieldCheck size={22} /></div>
            <div><h2 className="text-xl font-bold text-slate-900">Mercado Pago Checkout Pro</h2><p className="mt-1 text-sm text-slate-500">Criação de cobranças e confirmação automática por webhook.</p></div>
          </div>
          <span className={`w-fit rounded-full px-4 py-2 text-xs font-bold ${mercadoPago?.pronto ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{mercadoPago?.pronto ? 'Conectado' : 'Credenciais pendentes'}</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${mercadoPago?.access_token_configurado ? 'border-green-200 bg-green-50' : 'bg-slate-50'}`}><p className="text-sm font-bold text-slate-900">Access Token</p><p className="mt-1 text-xs text-slate-500">{mercadoPago?.access_token_configurado ? 'Configurado com segurança no servidor.' : 'Aguardando configuração na Vercel.'}</p></div>
          <div className={`rounded-2xl border p-4 ${mercadoPago?.webhook_secret_configurado ? 'border-green-200 bg-green-50' : 'bg-slate-50'}`}><p className="text-sm font-bold text-slate-900">Assinatura do webhook</p><p className="mt-1 text-xs text-slate-500">{mercadoPago?.webhook_secret_configurado ? 'Validação das notificações ativa.' : 'Aguardando a chave secreta do webhook.'}</p></div>
        </div>

        {mercadoPago?.webhook_url && <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-300"><Webhook size={15} /> URL do webhook</p><p className="mt-2 break-all font-mono text-xs leading-5">{mercadoPago.webhook_url}</p></div>}

        <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>As chaves nunca são salvas no banco nem exibidas nesta tela.</p>
          <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-2 font-semibold text-sky-700 hover:text-sky-800"><ExternalLink size={16} /> Abrir integrações</a>
        </div>
      </Card>
    </div>
  )
}
