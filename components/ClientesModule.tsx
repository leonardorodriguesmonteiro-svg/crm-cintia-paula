'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAcesso } from '@/components/auth/AcessoContext'

type Cliente = {
  id: string
  nome: string
  cpf?: string
  rg?: string
  whatsapp?: string
  instagram?: string
  email?: string
  cep?: string
  endereco?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  observacoes?: string
  created_at?: string
}

const empty = {
  nome: '',
  cpf: '',
  rg: '',
  whatsapp: '',
  instagram: '',
  email: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  observacoes: ''
}

function somenteDigitos(valor: string | null | undefined = '') {
  return (valor || '').replace(/\D/g, '')
}

function formatarCelular(valor: string | null | undefined = '') {
  const digitos = somenteDigitos(valor).slice(0, 11)

  if (digitos.length <= 2) return digitos
  if (digitos.length <= 7) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`

  const inicioNumero = digitos.length === 11 ? 7 : 6
  return `${digitos.slice(0, 2)} ${digitos.slice(2, inicioNumero)}-${digitos.slice(inicioNumero)}`
}

function formatarCpf(valor: string | null | undefined = '') {
  const digitos = somenteDigitos(valor).slice(0, 11)
  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatarCep(valor: string | null | undefined = '') {
  const digitos = somenteDigitos(valor).slice(0, 8)
  return digitos.replace(/^(\d{5})(\d)/, '$1-$2')
}

export function ClientesModule(){
  const { acesso } = useAcesso()
  const podeGerenciar = acesso?.perfil === 'Administrador' || acesso?.perfil === 'Comercial'
  const [clientes,setClientes]=useState<Cliente[]>([])
  const [form,setForm]=useState<any>(empty)
  const [editId,setEditId]=useState<string|null>(null)
  const [busca,setBusca]=useState('')
  const [msg,setMsg]=useState('')

  async function load(){
    const { data, error } = await supabase.from('clientes').select('*').order('created_at',{ascending:false})
    if(error) setMsg(error.message); else setClientes(data||[])
  }
  useEffect(()=>{load()},[])

  const filtered = useMemo(()=>clientes.filter(c => [
    c.nome,
    c.cpf,
    c.rg,
    c.whatsapp,
    c.instagram,
    c.email,
    c.endereco,
    c.bairro,
    c.cidade
  ].join(' ').toLowerCase().includes(busca.toLowerCase())),[clientes,busca])

  async function save(e:React.FormEvent){
    e.preventDefault(); setMsg('')
    const celular = somenteDigitos(form.whatsapp)
    const cpf = somenteDigitos(form.cpf)

    if(!form.nome || !celular) return setMsg('Nome e celular são obrigatórios.')
    if(celular.length < 10) return setMsg('Informe o celular com DDD.')
    if(cpf && cpf.length !== 11) return setMsg('Informe um CPF válido ou deixe o campo em branco.')

    const payload = {
      nome: String(form.nome || '').trim(),
      cpf: cpf || null,
      rg: String(form.rg || '').trim() || null,
      whatsapp: celular,
      instagram: String(form.instagram || '').trim() || null,
      email: String(form.email || '').trim().toLowerCase() || null,
      cep: somenteDigitos(form.cep) || null,
      endereco: String(form.endereco || '').trim() || null,
      numero: String(form.numero || '').trim() || null,
      complemento: String(form.complemento || '').trim() || null,
      bairro: String(form.bairro || '').trim() || null,
      cidade: String(form.cidade || '').trim() || null,
      estado: String(form.estado || '').trim().toUpperCase().slice(0, 2) || null,
      observacoes: String(form.observacoes || '').trim() || null
    }
    const res = editId ? await supabase.from('clientes').update(payload).eq('id',editId) : await supabase.from('clientes').insert(payload)
    if(res.error){ setMsg(res.error.message.includes('duplicate') ? 'Cliente já cadastrado por CPF ou WhatsApp.' : res.error.message); return }
    setForm(empty); setEditId(null); load()
  }
  function edit(c:Cliente){
    setEditId(c.id)
    setForm({
      ...c,
      cpf: formatarCpf(c.cpf),
      whatsapp: formatarCelular(c.whatsapp),
      cep: formatarCep(c.cep)
    })
    window.scrollTo({top:0,behavior:'smooth'})
  }
  function wa(num?:string){ if(num) window.open(`https://wa.me/55${num.replace(/\D/g,'')}`,'_blank') }
  function insta(user?:string){ if(user) window.open(`https://instagram.com/${user.replace('@','')}`,'_blank') }

  return <div className="p-4 md:p-8 space-y-6">
    <div><h1 className="text-2xl font-bold">Clientes</h1><p className="text-slate-500">Cadastre e gerencie clientes da Cintia Paula.</p></div>
    {podeGerenciar ? <form onSubmit={save} className="card space-y-5 p-4">
      <div>
        <h2 className="font-semibold text-slate-900">{editId ? 'Editar cliente' : 'Novo cliente'}</h2>
        <p className="text-sm text-slate-500">Dados de contato, documentos e endereço completo.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <input className="input" placeholder="Nome completo *" value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}/>
        <input className="input" inputMode="tel" placeholder="Celular com DDD * — 21 99999-9999" value={form.whatsapp||''} onChange={e=>setForm({...form,whatsapp:formatarCelular(e.target.value)})}/>
        <input className="input" type="email" placeholder="E-mail" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/>
        <input className="input" inputMode="numeric" placeholder="CPF (opcional)" value={form.cpf||''} onChange={e=>setForm({...form,cpf:formatarCpf(e.target.value)})}/>
        <input className="input" placeholder="RG" value={form.rg||''} onChange={e=>setForm({...form,rg:e.target.value})}/>
        <input className="input" placeholder="Instagram — @usuario" value={form.instagram||''} onChange={e=>setForm({...form,instagram:e.target.value})}/>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <input className="input" inputMode="numeric" placeholder="CEP" value={form.cep||''} onChange={e=>setForm({...form,cep:formatarCep(e.target.value)})}/>
        <input className="input md:col-span-2" placeholder="Logradouro — rua, avenida..." value={form.endereco||''} onChange={e=>setForm({...form,endereco:e.target.value})}/>
        <input className="input" placeholder="Número" value={form.numero||''} onChange={e=>setForm({...form,numero:e.target.value})}/>
        <input className="input" placeholder="Complemento" value={form.complemento||''} onChange={e=>setForm({...form,complemento:e.target.value})}/>
        <input className="input" placeholder="Bairro" value={form.bairro||''} onChange={e=>setForm({...form,bairro:e.target.value})}/>
        <input className="input" placeholder="Cidade" value={form.cidade||''} onChange={e=>setForm({...form,cidade:e.target.value})}/>
        <input className="input" maxLength={2} placeholder="UF" value={form.estado||''} onChange={e=>setForm({...form,estado:e.target.value.toUpperCase()})}/>
      </div>
      <textarea className="input min-h-24" placeholder="Observações sobre o cliente" value={form.observacoes||''} onChange={e=>setForm({...form,observacoes:e.target.value})}/>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary">{editId?'Salvar edição':'Cadastrar cliente'}</button>
        {editId && <button type="button" className="btn-secondary" onClick={()=>{setEditId(null);setForm(empty);setMsg('')}}>Cancelar</button>}
      </div>
    </form> : <div className="card border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Seu perfil possui acesso de consulta aos clientes. Inclusões e alterações são realizadas pelo Comercial.</div>}
    {msg && <p className="text-sm text-red-600">{msg}</p>}
    <input className="input" placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)}/>
    <div className="grid gap-3">
      {filtered.map(c=><div key={c.id} className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1"><p className="font-semibold">{c.nome}</p><p className="text-sm text-slate-500">CPF: {formatarCpf(c.cpf) || '-'} • RG: {c.rg || '-'} • Celular: {formatarCelular(c.whatsapp) || '-'}</p><p className="text-sm text-slate-500">{c.email || 'Sem e-mail'}{c.instagram ? ` • ${c.instagram}` : ''}</p><p className="text-sm text-slate-500">{[c.endereco, c.numero, c.complemento, c.bairro, c.cidade, c.estado].filter(Boolean).join(', ') || 'Endereço não informado'}</p>{c.observacoes && <p className="text-sm text-slate-600"><strong>Observações:</strong> {c.observacoes}</p>}</div>
        <div className="flex flex-wrap gap-2">{podeGerenciar && <button className="btn-secondary" onClick={()=>edit(c)}>Editar</button>}<button className="btn-secondary" onClick={()=>wa(c.whatsapp)}>WhatsApp</button><button className="btn-secondary" onClick={()=>insta(c.instagram)}>Instagram</button></div>
      </div>)}
    </div>
  </div>
}
