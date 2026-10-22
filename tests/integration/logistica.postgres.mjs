import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db=new PGlite()
await db.exec('create role anon; create role authenticated; create role service_role;')
const migration=readFileSync('supabase/migrations/20261022150229_contrato_local_evento_agendamento.sql','utf8')
await db.exec(migration.slice(migration.indexOf('create or replace function public.dia_atendimento_empresa'),migration.indexOf('alter function public.completar_cadastro')))
const api={};new Function('exports',ts.transpileModule(readFileSync('lib/logisticaContrato.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api)
const rows=(await db.query("select d::date::text d, dia_atendimento_empresa(d::date) util, proximo_dia_atendimento_empresa(d::date)::text proximo from generate_series('2026-01-01'::date,'2027-12-31'::date,'1 day') d")).rows
for(const r of rows){assert.equal(r.util,api.diaAtendimento(r.d),r.d);assert.equal(r.proximo,api.proximoDiaAtendimento(r.d),r.d)}
const valid={modalidade:'Retirada',tipo_local_evento:'Salão de festas',endereco_evento:'Rua do Evento, 100, Centro, Rio de Janeiro - RJ',data_retirada:'2026-10-29',horario_retirada:'10:00',horario_devolucao:'14:00',data_devolucao:'2026-10-30',endereco_retirada:'Endereço forjado'}
const validate=async data=>(await db.query("select validar_logistica_contrato('2026-10-29',$1::jsonb) v",[JSON.stringify(data)])).rows[0].v
const result=await validate(valid);assert.equal(result.data_devolucao,'2026-11-03');assert.equal(result.endereco_retirada,api.ENDERECO_RETIRADA)
for(const extra of [{tipo_local_evento:''},{endereco_evento:''},{horario_retirada:'13:00'},{horario_devolucao:'18:30'},{data_retirada:'2026-10-30'},{data_retirada:'2026-10-24'}])await assert.rejects(validate({...valid,...extra}))
assert.equal((await validate({...valid,modalidade:'Entrega',data_retirada:''})).data_retirada,null)
console.log('PASS: 730 datas UI/SQL idênticas, feriados, pontos facultativos, horários, endereço fixo, devolução calculada no servidor e rejeição de dados inválidos')
await db.close()
