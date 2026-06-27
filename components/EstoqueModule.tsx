'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Item={id:string;codigo:string;nome:string;categoria?:string;cor?:string;quantidade_total?:number;quantidade_manutencao?:number;valor_reposicao?:number;status?:string;created_at?:string}
const empty={codigo:'',nome:'',categoria:'',cor:'',quantidade_total:1,quantidade_manutencao:0,valor_reposicao:0,status:'Disponível'}
export function EstoqueModule(){
 const [items,setItems]=useState<Item[]>([]); const [form,setForm]=useState<any>(empty); const [editId,setEditId]=useState<string|null>(null); const [msg,setMsg]=useState('')
 async function load(){const {data,error}=await supabase.from('estoque_itens').select('*').order('created_at',{ascending:false}); if(error)setMsg(error.message); else setItems(data||[])}
 useEffect(()=>{load()},[])
 async function save(e:React.FormEvent){e.preventDefault(); setMsg(''); if(!form.codigo||!form.nome)return setMsg('Código e nome são obrigatórios.'); const payload={...form,quantidade_total:Number(form.quantidade_total||0),quantidade_manutencao:Number(form.quantidade_manutencao||0),valor_reposicao:Number(form.valor_reposicao||0)}; const res=editId?await supabase.from('estoque_itens').update(payload).eq('id',editId):await supabase.from('estoque_itens').insert(payload); if(res.error){setMsg(res.error.message);return} setForm(empty); setEditId(null); load()}
 function edit(i:Item){setEditId(i.id);setForm(i);window.scrollTo({top:0,behavior:'smooth'})}
 return <div className="p-4 md:p-8 space-y-6"><div><h1 className="text-2xl font-bold">Estoque</h1><p className="text-slate-500">Controle de peças individuais e reposição.</p></div>
 <form onSubmit={save} className="card p-4 grid gap-3 md:grid-cols-4"><input className="input" placeholder="Código" value={form.codigo||''} onChange={e=>setForm({...form,codigo:e.target.value})}/><input className="input" placeholder="Nome do item" value={form.nome||''} onChange={e=>setForm({...form,nome:e.target.value})}/><input className="input" placeholder="Categoria" value={form.categoria||''} onChange={e=>setForm({...form,categoria:e.target.value})}/><input className="input" placeholder="Cor" value={form.cor||''} onChange={e=>setForm({...form,cor:e.target.value})}/><input className="input" type="number" placeholder="Qtd total" value={form.quantidade_total||0} onChange={e=>setForm({...form,quantidade_total:e.target.value})}/><input className="input" type="number" placeholder="Manutenção" value={form.quantidade_manutencao||0} onChange={e=>setForm({...form,quantidade_manutencao:e.target.value})}/><input className="input" type="number" placeholder="Valor reposição" value={form.valor_reposicao||0} onChange={e=>setForm({...form,valor_reposicao:e.target.value})}/><input className="input" placeholder="Status" value={form.status||''} onChange={e=>setForm({...form,status:e.target.value})}/><button className="btn-primary md:col-span-4">{editId?'Salvar edição':'Cadastrar item'}</button>{msg&&<p className="text-sm text-red-600 md:col-span-4">{msg}</p>}</form>
 <div className="grid gap-3">{items.map(i=><div key={i.id} className="card p-4 flex justify-between gap-4"><div><p className="font-semibold">{i.codigo} • {i.nome}</p><p className="text-sm text-slate-500">{i.categoria} • {i.cor}</p><p className="text-sm">Total: {i.quantidade_total} • Manutenção: {i.quantidade_manutencao}</p></div><button onClick={()=>edit(i)} className="btn-secondary">Editar</button></div>)}</div>
 </div>
}
