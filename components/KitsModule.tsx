'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Kit = { id:string; codigo:string; nome:string; tema?:string; categoria?:string; quantidade?:number; valor?:number; status?:string; foto_url?:string; descricao?:string; observacoes?:string; created_at?:string }
const empty = { codigo:'', nome:'', tema:'', categoria:'', quantidade:1, valor:0, status:'Disponível', foto_url:'', descricao:'', observacoes:'' }

export function KitsModule(){
  const [kits,setKits]=useState<Kit[]>([]); const [form,setForm]=useState<any>(empty); const [editId,setEditId]=useState<string|null>(null); const [busca,setBusca]=useState(''); const [msg,setMsg]=useState('')
  async function load(){ const {data,error}=await supabase.from('kits').select('*').order('created_at',{ascending:false}); if(error)setMsg(error.message); else setKits(data||[]) }
  useEffect(()=>{load()},[])
  const filtered=useMemo(()=>kits.filter(k=>`${k.codigo} ${k.nome} ${k.tema}`.toLowerCase().includes(busca.toLowerCase())),[kits,busca])
  async function save(e:React.FormEvent){ e.preventDefault(); setMsg(''); if(!form.codigo||!form.nome)return setMsg('Código e nome são obrigatórios.'); const payload={...form, quantidade:Number(form.quantidade||1), valor:Number(form.valor||0)}; const res=editId?await supabase.from('kits').update(payload).eq('id',editId):await supabase.from('kits').insert(payload); if(res.error){setMsg(res.error.message.includes('duplicate')?'Código de kit já cadastrado.':res.error.message);return} setForm(empty); setEditId(null); load() }
  function edit(k:Kit){setEditId(k.id);setForm(k);window.scrollTo({top:0,behavior:'smooth'})}
  return <div className="p-4 md:p-8 space-y-6"><div><h1 className="text-2xl font-bold">Kits</h1><p className="text-slate-500">Cadastre temas, valores e disponibilidade dos kits.</p></div>
    <form onSubmit={save} className="card p-4 grid gap-3 md:grid-cols-3">
      <input className="input" placeholder="Código do kit" value={form.codigo||''} onChange={e=>setForm({...form,codigo:e.target.value})}/><input className="input" placeholder="Nome do kit" value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}/><input className="input" placeholder="Tema" value={form.tema||''} onChange={e=>setForm({...form,tema:e.target.value})}/>
      <input className="input" placeholder="Categoria" value={form.categoria||''} onChange={e=>setForm({...form,categoria:e.target.value})}/><input className="input" placeholder="Quantidade" type="number" value={form.quantidade||1} onChange={e=>setForm({...form,quantidade:e.target.value})}/><input className="input" placeholder="Valor" type="number" value={form.valor||0} onChange={e=>setForm({...form,valor:e.target.value})}/>
      <input className="input" placeholder="URL da foto" value={form.foto_url||''} onChange={e=>setForm({...form,foto_url:e.target.value})}/><input className="input" placeholder="Status" value={form.status||''} onChange={e=>setForm({...form,status:e.target.value})}/><input className="input" placeholder="Descrição" value={form.descricao||''} onChange={e=>setForm({...form,descricao:e.target.value})}/>
      <button className="btn-primary md:col-span-3">{editId?'Salvar edição':'Cadastrar kit'}</button>{msg&&<p className="text-sm text-red-600 md:col-span-3">{msg}</p>}
    </form>
    <input className="input" placeholder="Buscar kit..." value={busca} onChange={e=>setBusca(e.target.value)}/>
    <div className="grid gap-3 md:grid-cols-2">{filtered.map(k=><div key={k.id} className="card p-4 flex gap-4"><div className="h-20 w-20 rounded-xl bg-pink-50 overflow-hidden flex-shrink-0">{k.foto_url?<img src={k.foto_url} className="h-full w-full object-cover"/>:<div/>}</div><div className="flex-1"><p className="font-semibold">{k.codigo} • {k.nome}</p><p className="text-sm text-slate-500">{k.tema} • {k.categoria}</p><p className="text-sm">R$ {Number(k.valor||0).toFixed(2)} • Qtde {k.quantidade}</p><button className="btn-secondary mt-2" onClick={()=>edit(k)}>Editar</button></div></div>)}</div>
  </div>
}
