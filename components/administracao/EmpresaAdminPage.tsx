'use client'

import { useEffect, useState } from 'react'
import { Building2, FileText, ImagePlus, Landmark, MapPin, Save, Upload } from 'lucide-react'
import { useAcesso } from '@/components/auth/AcessoContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { supabase } from '@/lib/supabase'
import { termosGeraisContrato } from '@/lib/contratoTermos'

type EmpresaFormulario = {
  nome_fantasia: string
  razao_social: string
  cnpj: string
  inscricao_estadual: string
  inscricao_municipal: string
  email: string
  telefone: string
  whatsapp: string
  site: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  logo_url: string
  contrato_padrao: string
}

const inicial: EmpresaFormulario = {
  nome_fantasia: '', razao_social: '', cnpj: '', inscricao_estadual: '', inscricao_municipal: '',
  email: '', telefone: '', whatsapp: '', site: '', cep: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cidade: '', estado: '', logo_url: '',
  contrato_padrao: termosGeraisContrato.join('\n\n')
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

export function EmpresaAdminPage() {
  const { acesso } = useAcesso()
  const [formulario, setFormulario] = useState<EmpresaFormulario>(inicial)
  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null)
  const [previewLogo, setPreviewLogo] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    if (!acesso?.empresa_id) return

    async function carregar() {
      setCarregando(true)
      setErro('')
      const { data, error } = await supabase
        .from('empresas')
        .select('nome,nome_fantasia,razao_social,cnpj,inscricao_estadual,inscricao_municipal,email,telefone,whatsapp,site,cep,logradouro,numero,complemento,bairro,cidade,estado,logo_url,contrato_padrao')
        .eq('id', acesso!.empresa_id)
        .maybeSingle()

      if (error) setErro(error.message)
      else if (data) {
        setFormulario({
          nome_fantasia: data.nome_fantasia || data.nome || '',
          razao_social: data.razao_social || data.nome || '',
          cnpj: data.cnpj || '', inscricao_estadual: data.inscricao_estadual || '',
          inscricao_municipal: data.inscricao_municipal || '', email: data.email || '',
          telefone: data.telefone || '', whatsapp: data.whatsapp || '', site: data.site || '',
          cep: data.cep || '', logradouro: data.logradouro || '', numero: data.numero || '',
          complemento: data.complemento || '', bairro: data.bairro || '', cidade: data.cidade || '',
          estado: data.estado || '', logo_url: data.logo_url || '',
          contrato_padrao: data.contrato_padrao || termosGeraisContrato.join('\n\n')
        })
      }
      setCarregando(false)
    }

    carregar()
  }, [acesso?.empresa_id])

  useEffect(() => {
    if (!arquivoLogo) {
      setPreviewLogo('')
      return
    }
    const url = URL.createObjectURL(arquivoLogo)
    setPreviewLogo(url)
    return () => URL.revokeObjectURL(url)
  }, [arquivoLogo])

  function atualizar(campo: keyof EmpresaFormulario, valor: string) {
    setFormulario(atual => ({ ...atual, [campo]: valor }))
  }

  function selecionarLogo(arquivo?: File) {
    setErro('')
    if (!arquivo) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type)) {
      setErro('A logo precisa estar em PNG, JPG ou WebP.')
      return
    }
    if (arquivo.size > 2 * 1024 * 1024) {
      setErro('A logo precisa ter no máximo 2 MB.')
      return
    }
    setArquivoLogo(arquivo)
  }

  async function enviarLogo() {
    if (!arquivoLogo || !acesso?.empresa_id) return formulario.logo_url
    const extensao = arquivoLogo.type === 'image/png' ? 'png' : arquivoLogo.type === 'image/webp' ? 'webp' : 'jpg'
    const caminho = `${acesso.empresa_id}/logo.${extensao}`
    const { error } = await supabase.storage.from('logos-empresa').upload(caminho, arquivoLogo, {
      upsert: true,
      contentType: arquivoLogo.type,
      cacheControl: '3600'
    })
    if (error) throw error
    const { data } = supabase.storage.from('logos-empresa').getPublicUrl(caminho)
    return `${data.publicUrl}?v=${Date.now()}`
  }

  async function salvar(evento: React.FormEvent) {
    evento.preventDefault()
    if (!acesso?.empresa_id) return
    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      if (formulario.nome_fantasia.trim().length < 2) throw new Error('Informe o nome fantasia da empresa.')
      if (formulario.cnpj && somenteDigitos(formulario.cnpj).length !== 14) throw new Error('Informe um CNPJ com 14 dígitos.')
      if (formulario.site) {
        const site = new URL(formulario.site)
        if (!['http:', 'https:'].includes(site.protocol)) throw new Error()
      }

      const logoUrl = await enviarLogo()
      const payload = Object.fromEntries(Object.entries({ ...formulario, logo_url: logoUrl }).map(([chave, valor]) => [chave, String(valor).trim() || null]))
      payload.cnpj = somenteDigitos(formulario.cnpj) || null
      payload.cep = somenteDigitos(formulario.cep) || null
      payload.estado = formulario.estado.trim().toUpperCase().slice(0, 2) || null

      const { error } = await supabase.from('empresas').update(payload).eq('id', acesso.empresa_id)
      if (error) throw error

      setFormulario(atual => ({ ...atual, logo_url: logoUrl }))
      setArquivoLogo(null)
      setSucesso('Dados da empresa salvos. Os próximos contratos já usarão esta identidade e o texto padrão.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar os dados da empresa.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <div className="p-8 text-sm text-slate-500">Carregando dados da empresa...</div>

  return (
    <form onSubmit={salvar} className="space-y-6 p-4 pb-28 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-semibold text-pink-700">ADMINISTRAÇÃO</p><h1 className="text-3xl font-bold text-slate-900">Dados da empresa</h1><p className="mt-1 text-slate-500">Identidade, dados fiscais e texto padrão dos contratos.</p></div>
        <Button type="submit" disabled={salvando} className="flex items-center justify-center gap-2"><Save size={17} />{salvando ? 'Salvando...' : 'Salvar alterações'}</Button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{sucesso}</div>}

      <Card>
        <div className="flex items-start gap-3"><div className="rounded-2xl bg-pink-50 p-3 text-pink-700"><Building2 size={22} /></div><div><h2 className="text-xl font-bold text-slate-900">Identidade da empresa</h2><p className="text-sm text-slate-500">Informações exibidas no ERP e nos documentos.</p></div></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[220px,1fr]">
          <div className="space-y-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-dashed bg-slate-50">
              {(previewLogo || formulario.logo_url) ? <img src={previewLogo || formulario.logo_url} alt="Logo da empresa" className="h-full w-full object-contain p-4" /> : <ImagePlus className="text-slate-300" size={54} />}
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload size={16} />Selecionar logo<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={evento => selecionarLogo(evento.target.files?.[0])} /></label>
            <p className="text-center text-xs text-slate-400">PNG, JPG ou WebP · até 2 MB</p>
          </div>
          <div className="grid content-start gap-4 md:grid-cols-2">
            <Input label="Nome fantasia *" value={formulario.nome_fantasia} onChange={evento => atualizar('nome_fantasia', evento.target.value)} />
            <Input label="Razão social" value={formulario.razao_social} onChange={evento => atualizar('razao_social', evento.target.value)} />
            <Input label="E-mail comercial" type="email" value={formulario.email} onChange={evento => atualizar('email', evento.target.value)} />
            <Input label="Site" type="url" placeholder="https://..." value={formulario.site} onChange={evento => atualizar('site', evento.target.value)} />
            <Input label="Telefone" value={formulario.telefone} onChange={evento => atualizar('telefone', evento.target.value)} />
            <Input label="WhatsApp" value={formulario.whatsapp} onChange={evento => atualizar('whatsapp', evento.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-start gap-3"><div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><Landmark size={22} /></div><div><h2 className="text-xl font-bold text-slate-900">Dados fiscais</h2><p className="text-sm text-slate-500">Identificação legal para documentos e integrações.</p></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input label="CNPJ" inputMode="numeric" value={formulario.cnpj} onChange={evento => atualizar('cnpj', evento.target.value)} />
            <Input label="Inscrição estadual" value={formulario.inscricao_estadual} onChange={evento => atualizar('inscricao_estadual', evento.target.value)} />
            <Input label="Inscrição municipal" value={formulario.inscricao_municipal} onChange={evento => atualizar('inscricao_municipal', evento.target.value)} />
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3"><div className="rounded-2xl bg-sky-50 p-3 text-sky-700"><MapPin size={22} /></div><div><h2 className="text-xl font-bold text-slate-900">Endereço</h2><p className="text-sm text-slate-500">Sede ou endereço comercial da empresa.</p></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Input label="CEP" inputMode="numeric" value={formulario.cep} onChange={evento => atualizar('cep', evento.target.value)} />
            <Input label="Logradouro" value={formulario.logradouro} onChange={evento => atualizar('logradouro', evento.target.value)} />
            <Input label="Número" value={formulario.numero} onChange={evento => atualizar('numero', evento.target.value)} />
            <Input label="Complemento" value={formulario.complemento} onChange={evento => atualizar('complemento', evento.target.value)} />
            <Input label="Bairro" value={formulario.bairro} onChange={evento => atualizar('bairro', evento.target.value)} />
            <Input label="Cidade" value={formulario.cidade} onChange={evento => atualizar('cidade', evento.target.value)} />
            <Input label="UF" maxLength={2} value={formulario.estado} onChange={evento => atualizar('estado', evento.target.value)} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-start gap-3"><div className="rounded-2xl bg-violet-50 p-3 text-violet-700"><FileText size={22} /></div><div><h2 className="text-xl font-bold text-slate-900">Contrato padrão</h2><p className="text-sm text-slate-500">Separe cada cláusula por uma linha em branco. O texto será aplicado aos próximos contratos.</p></div></div>
        <Textarea className="mt-6 min-h-72 font-mono leading-6" value={formulario.contrato_padrao} onChange={evento => atualizar('contrato_padrao', evento.target.value)} maxLength={20000} />
      </Card>
    </form>
  )
}
