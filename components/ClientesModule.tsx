'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Cliente = { id:string; nome:string; cpf?:string; whatsapp?:string; instagram?:string; cidade?:string; bairro?:string; created_at?:string }
const empty = { nome:'', cpf:'', whatsapp:'', instagram:'', cidade:'', bairro:'' }

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
    if(!form.nome || !form.cpf) return setMsg('Nome e CPF são obrigatórios.')
    const payload = { ...form, cpf: form.cpf.replace(/\D/g,''), whatsapp: form.whatsapp.replace(/\D/g,'') }
    const res = editId ? await supabase.from('clientes').update(payload).eq('id',editId) : await supabase.from('clientes').insert(payload)
    if(res.error){ setMsg(res.error.message.includes('duplicate') ? 'Cliente já cadastrado por CPF ou WhatsApp.' : res.error.message); return }
    setForm(empty); setEditId(null); load()
  }
  function edit(c:Cliente){ setEditId(c.id); setForm(c); window.scrollTo({top:0,behavior:'smooth'}) }
  function wa(num?:string){ if(num) window.open(`https://wa.me/55${num.replace(/\D/g,'')}`,'_blank') }
  function insta(user?:string){ if(user) window.open(`https://instagram.com/${user.replace('@','')}`,'_blank') }

  return <div className="p-4 md:p-8 space-y-6">
    <div><h1 className="text-2xl font-bold">Clientes</h1><p className="text-slate-500">Cadastre e gerencie clientes da Cintia Paula.</p></div>
    <form onSubmit={save} className="card p-4 grid gap-3 md:grid-cols-3">
      <input className="input" placeholder="Nome completo" value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}/>
      <input className="input" placeholder="CPF obrigatório" value={form.cpf||''} onChange={e=>setForm({...form,cpf:e.target.value})}/>
      <input className="input" placeholder="WhatsApp" value={form.whatsapp||''} onChange={e=>setForm({...form,whatsapp:e.target.value})}/>
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
