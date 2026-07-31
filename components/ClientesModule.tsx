'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Cliente = { id:string; nome:string; cpf?:string; whatsapp?:string; instagram?:string; cidade?:string; bairro?:string; created_at?:string }
const empty = { nome:'', cpf:'', whatsapp:'', instagram:'', cidade:'', bairro:'' }

function somenteDigitos(valor = '') {
  return valor.replace(/\D/g, '')
}

function formatarCelular(valor = '') {
  const digitos = somenteDigitos(valor).slice(0, 11)

  if (digitos.length <= 2) return digitos
  if (digitos.length <= 7) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`

  const inicioNumero = digitos.length === 11 ? 7 : 6
  return `${digitos.slice(0, 2)} ${digitos.slice(2, inicioNumero)}-${digitos.slice(inicioNumero)}`
}

function formatarCpf(valor = '') {
  const digitos = somenteDigitos(valor).slice(0, 11)
  return digitos
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function ClientesModule(){
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

  const filtered = useMemo(()=>clientes.filter(c => `${c.nome} ${c.cpf} ${c.whatsapp}`.toLowerCase().includes(busca.toLowerCase())),[clientes,busca])

  async function save(e:React.FormEvent){
    e.preventDefault(); setMsg('')
    const celular = somenteDigitos(form.whatsapp)
    const cpf = somenteDigitos(form.cpf)

    if(!form.nome || !celular) return setMsg('Nome e celular são obrigatórios.')
    if(celular.length < 10) return setMsg('Informe o celular com DDD.')
    if(cpf && cpf.length !== 11) return setMsg('Informe um CPF válido ou deixe o campo em branco.')

    const payload = { ...form, cpf: cpf || null, whatsapp: celular }
    const res = editId ? await supabase.from('clientes').update(payload).eq('id',editId) : await supabase.from('clientes').insert(payload)
    if(res.error){ setMsg(res.error.message.includes('duplicate') ? 'Cliente já cadastrado por CPF ou WhatsApp.' : res.error.message); return }
    setForm(empty); setEditId(null); load()
  }
  function edit(c:Cliente){
    setEditId(c.id)
    setForm({
      ...c,
      cpf: formatarCpf(c.cpf),
      whatsapp: formatarCelular(c.whatsapp)
    })
    window.scrollTo({top:0,behavior:'smooth'})
  }
  function wa(num?:string){ if(num) window.open(`https://wa.me/55${num.replace(/\D/g,'')}`,'_blank') }
  function insta(user?:string){ if(user) window.open(`https://instagram.com/${user.replace('@','')}`,'_blank') }

  return <div className="p-4 md:p-8 space-y-6">
    <div><h1 className="text-2xl font-bold">Clientes</h1><p className="text-slate-500">Cadastre e gerencie clientes da Cintia Paula.</p></div>
    <form onSubmit={save} className="card p-4 grid gap-3 md:grid-cols-3">
      <input className="input" placeholder="Nome completo *" value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}/>
      <input className="input" inputMode="numeric" placeholder="CPF (opcional)" value={form.cpf||''} onChange={e=>setForm({...form,cpf:formatarCpf(e.target.value)})}/>
      <input className="input" inputMode="tel" placeholder="Celular com DDD * — 21 99999-9999" value={form.whatsapp||''} onChange={e=>setForm({...form,whatsapp:formatarCelular(e.target.value)})}/>
      <input className="input" placeholder="Instagram" value={form.instagram||''} onChange={e=>setForm({...form,instagram:e.target.value})}/>
      <input className="input" placeholder="Cidade" value={form.cidade||''} onChange={e=>setForm({...form,cidade:e.target.value})}/>
      <input className="input" placeholder="Bairro" value={form.bairro||''} onChange={e=>setForm({...form,bairro:e.target.value})}/>
      <button className="btn-primary md:col-span-3">{editId?'Salvar edição':'Cadastrar cliente'}</button>
      {msg && <p className="text-sm text-red-600 md:col-span-3">{msg}</p>}
    </form>
    <input className="input" placeholder="Buscar cliente..." value={busca} onChange={e=>setBusca(e.target.value)}/>
    <div className="grid gap-3">
      {filtered.map(c=><div key={c.id} className="card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div><p className="font-semibold">{c.nome}</p><p className="text-sm text-slate-500">CPF: {c.cpf || '-'} • WhatsApp: {c.whatsapp || '-'}</p><p className="text-sm text-slate-500">{c.bairro} {c.cidade}</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={()=>edit(c)}>Editar</button><button className="btn-secondary" onClick={()=>wa(c.whatsapp)}>WhatsApp</button><button className="btn-secondary" onClick={()=>insta(c.instagram)}>Instagram</button></div>
      </div>)}
    </div>
  </div>
}
