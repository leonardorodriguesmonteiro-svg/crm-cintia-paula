'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, CreditCard, ExternalLink, FileClock, MessageSquareText, Save, ShieldCheck, UserCog, Webhook } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

type ConfiguracaoPagamento = {
  pix_chave: string
  pix_beneficiario: string
  pix_cidade: string
  link_pagamento: string
  instrucoes: string
}

const configuracaoInicial: ConfiguracaoPagamento = {
  pix_chave: '',
  pix_beneficiario: 'Cintia Paula',
  pix_cidade: 'Rio de Janeiro',
  link_pagamento: '',
  instrucoes: 'Após o pagamento, envie o comprovante para a equipe Cintia Paula.'
}

type StatusMercadoPago = {
  access_token_configurado: boolean
  webhook_secret_configurado: boolean
  pronto: boolean
  webhook_url: string
}

export function ConfiguracoesPage() {
  const [configuracao, setConfiguracao] = useState(configuracaoInicial)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mercadoPago, setMercadoPago] = useState<StatusMercadoPago | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')

    const { data, error } = await supabase
      .from('configuracoes_pagamento')
      .select('pix_chave,pix_beneficiario,pix_cidade,link_pagamento,instrucoes')
      .eq('id', true)
      .maybeSingle()

    if (error) setErro(error.message)
    else if (data) setConfiguracao({
      pix_chave: data.pix_chave || '',
      pix_beneficiario: data.pix_beneficiario || '',
      pix_cidade: data.pix_cidade || '',
      link_pagamento: data.link_pagamento || '',
      instrucoes: data.instrucoes || ''
    })

    try {
      const resposta = await fetch('/api/pagamentos/mercado-pago/status', { cache: 'no-store' })
      if (resposta.ok) setMercadoPago(await resposta.json())
    } catch {
      setMercadoPago(null)
    }

    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function atualizar(campo: keyof ConfiguracaoPagamento, valor: string) {
    setConfiguracao(atual => ({ ...atual, [campo]: valor }))
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (!configuracao.pix_chave.trim() && !configuracao.link_pagamento.trim()) {
      setErro('Informe uma chave Pix ou um link de pagamento.')
      return
    }

    if (configuracao.link_pagamento.trim()) {
      try {
        const url = new URL(configuracao.link_pagamento)
        if (url.protocol !== 'https:') throw new Error()
      } catch {
        setErro('O link de pagamento precisa ser uma URL segura iniciada por https://.')
        return
      }
    }

    setSalvando(true)

    const { error } = await supabase.from('configuracoes_pagamento').upsert({
      id: true,
      pix_chave: configuracao.pix_chave.trim() || null,
      pix_beneficiario: configuracao.pix_beneficiario.trim() || 'Cintia Paula',
      pix_cidade: configuracao.pix_cidade.trim() || 'Rio de Janeiro',
      link_pagamento: configuracao.link_pagamento.trim() || null,
      instrucoes: configuracao.instrucoes.trim() || null,
      updated_at: new Date().toISOString()
    })

    if (error) setErro(error.message)
    else setSucesso('Configurações de pagamento salvas. Os próximos contratos já usarão estes dados.')

    setSalvando(false)
  }

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
          <p className="mt-1 text-sm text-slate-500">Logo, cadastro fiscal, endereço e contrato padrão.</p>
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
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-pink-50 p-3 text-pink-700"><CreditCard size={22} /></div>
          <div><h2 className="text-xl font-bold text-slate-900">Recebimento do sinal</h2><p className="mt-1 text-sm text-slate-500">Configure pelo menos uma forma de pagamento. O Pix Copia e Cola é gerado com o valor exato de cada sinal.</p></div>
        </div>

        {erro && <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
        {sucesso && <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

        {carregando ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Carregando configurações...</div>
        ) : (
          <form onSubmit={salvar} className="mt-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Chave Pix" placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" maxLength={77} value={configuracao.pix_chave} onChange={evento => atualizar('pix_chave', evento.target.value)} />
              <Input label="Link externo de pagamento (opcional)" type="url" placeholder="https://..." value={configuracao.link_pagamento} onChange={evento => atualizar('link_pagamento', evento.target.value)} />
              <Input label="Beneficiário do Pix" maxLength={25} value={configuracao.pix_beneficiario} onChange={evento => atualizar('pix_beneficiario', evento.target.value)} />
              <Input label="Cidade do beneficiário" maxLength={15} value={configuracao.pix_cidade} onChange={evento => atualizar('pix_cidade', evento.target.value)} />
            </div>

            <Textarea label="Orientação ao cliente" rows={3} maxLength={500} value={configuracao.instrucoes} onChange={evento => atualizar('instrucoes', evento.target.value)} />

            <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2"><MessageSquareText className="mt-0.5 shrink-0 text-pink-600" size={17} />O ERP não dará baixa automaticamente até que o recebimento seja confirmado no Financeiro.</p>
              <Button type="submit" disabled={salvando} className="flex shrink-0 items-center justify-center gap-2"><Save size={17} /> {salvando ? 'Salvando...' : 'Salvar pagamento'}</Button>
            </div>
          </form>
        )}
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
