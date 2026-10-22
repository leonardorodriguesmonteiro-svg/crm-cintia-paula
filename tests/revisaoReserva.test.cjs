const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest, NextResponse } = require('next/server')
function load(path,mocks) {const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>mocks[id]||{},exports);return exports}
function routeFixture({error=null,notice=true,deny=false}={}) {
 const calls=[]
 const route=load('app/api/reservas/[id]/revisar/route.ts',{
 'next/server':{NextResponse},
 '@/lib/server/adminAuth':{exigirPerfis:async()=>{if(deny)throw new Error('Sem sessão');return{usuario:{id:'user'},vinculo:{empresa_id:'tenant'}}},respostaErroAdministrativo:()=>({status:401,mensagem:'Sem sessão'})},
 '@/lib/supabaseServer':{supabaseServer:{rpc:async(name,args)=>{calls.push(args);return {data:{alterado:true,contrato_cancelado_id:'old'},error}}}},
 '@/lib/contratoCancelamentoEmail':{avisarCancelamentoContrato:async id=>{calls.push(id);if(notice==='throw')throw new Error('lookup failed');return {enviado:notice}}}
 })
 return {calls,run:body=>route.POST(new NextRequest('https://erp.example/api/reservas/id/revisar',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:'reservation'})})}
}

test('revisão usa identidade autenticada e só notifica após transação concluída',async()=>{
 const f=routeFixture(); const r=await f.run({revisao:1,empresa_id:'attacker',usuario_id:'attacker'})
 assert.equal(r.status,200);assert.equal(f.calls[0].p_empresa_id,'tenant');assert.equal(f.calls[0].p_usuario_id,'user');assert.equal(f.calls[1],'old')
})
test('conflito, sessão ausente e versão ausente não enviam avisos',async()=>{
 for(const [options,body,status,length] of [[{error:{code:'40001',message:'Atualize'}},{revisao:1},409,1],[{deny:true},{revisao:1},401,0],[{},{},400,0]]) {
 const f=routeFixture(options); assert.equal((await f.run(body)).status,status);assert.equal(f.calls.length,length)
 }
})
test('falha do aviso mantém edição salva e informa pendência',async()=>{
 for(const notice of [false,'throw']) {const r=await routeFixture({notice}).run({revisao:1});assert.equal(r.status,200);assert.match((await r.json()).mensagem,/pendente/)}
})
function emailFixture({sent=false,claim=true,status='Cancelado',provider=true}={}) {
 const updates=[];let sends=0;const contract={id:'old',numero_contrato:'CTR-1',status,cancelado_em:'today',notificacao_cancelamento_em:sent?'today':null,snapshot_contratual:{cliente:{email:'test@example.com'}}}
 const db={from(){let patch=null;const q={select(){return q},eq(){return q},is(){return q},or(){return q},update(v){patch=v;updates.push(v);return q},single:async()=>({data:contract}),maybeSingle:async()=>({data:claim?{id:'old'}:null}),then(resolve){return Promise.resolve({error:null}).then(resolve)}};return q}}
 const mod=load('lib/contratoCancelamentoEmail.ts',{'@/lib/supabaseServer':{supabaseServer:db}})
 return {updates,async run(){const old=global.fetch;const key=process.env.RESEND_API_KEY,from=process.env.EMAIL_REMETENTE;process.env.RESEND_API_KEY='test';process.env.EMAIL_REMETENTE='test@example.com';global.fetch=async(url,args)=>{sends++;assert.equal(args.headers['Idempotency-Key'],'cancelamento-contrato-old');assert.match(JSON.parse(args.body).text,/pagamentos já registrados permanecem preservados/);return{ok:provider}};try{return await mod.avisarCancelamentoContrato('old')}finally{global.fetch=old;if(key===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=key;if(from===undefined)delete process.env.EMAIL_REMETENTE;else process.env.EMAIL_REMETENTE=from}},get sends(){return sends}}
}
test('aviso registra aceite do provedor e não duplica envio já registrado ou em andamento',async()=>{
 const f=emailFixture();assert.equal((await f.run()).enviado,true);assert.equal(f.sends,1);assert.ok(f.updates.some(v=>v.notificacao_cancelamento_em))
 for(const config of [{sent:true},{claim:false}]){const g=emailFixture(config);await g.run();assert.equal(g.sends,0)}
})
test('aviso recusado permanece pendente; contrato ativo não pode receber cancelamento',async()=>{
 const f=emailFixture({provider:false});assert.equal((await f.run()).enviado,false);assert.ok(f.updates.some(v=>v.notificacao_cancelamento_erro));assert.ok(!f.updates.some(v=>v.notificacao_cancelamento_em))
 const g=emailFixture({status:'Assinado'});await assert.rejects(()=>g.run());assert.equal(g.sends,0)
})
test('link de contrato cancelado retorna 410 sem consultar dados pessoais',async()=>{
 let tables=[];const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{status:'Cancelado'}})}
 const route=load('app/api/contratos/[id]/route.ts',{'next/server':{NextResponse},'@/lib/supabaseServer':{supabaseServer:{from(t){tables.push(t);return q}}}})
 const r=await route.GET(null,{params:Promise.resolve({id:'199045fa-7ed8-41c5-9540-267cf673c454'})});assert.equal(r.status,410);assert.deepEqual(tables,['contratos']);assert.match((await r.json()).error,/cancelada/)
})
