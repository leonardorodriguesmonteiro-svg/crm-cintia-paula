const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const ts=require('typescript')
function fixture({consent=true,response=200,configured=true}={}) {
 const rows=[];const calls=[]
 const server={from(table){
  let filters=[],update=null,mode='read';
  const q={select(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},order(){return q},limit(){return q},
   update(v){update=v;mode='update';return q},
   async upsert(v){if(!rows.some(r=>r.canal===v.canal)) rows.push({...v,id:v.canal});return{error:null}},
   result(){if(table==='oportunidades')return{data:{numero:15,email:'test@example.com',celular:'11999999999'},error:null};if(table==='acompanhamento_links')return{data:{token_hash:'hash',whatsapp_consentido_em:consent?'2026-09-21':null},error:null};const found=rows.filter(r=>filters.every(f=>f(r)));if(mode==='update')found.forEach(r=>Object.assign(r,update));return{data:found,error:null}},
   async single(){return q.result()},async maybeSingle(){const r=q.result();return {...r,data:Array.isArray(r.data)?r.data[0]||null:r.data}},
   then(resolve,reject){return Promise.resolve(q.result()).then(resolve,reject)} };return q
 }}
 const source=ts.transpileModule(fs.readFileSync('lib/server/acompanhamentoEnvios.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const exports={}
 const env=configured?{RESEND_API_KEY:'test',EMAIL_REMETENTE:'test@example.com',WHATSAPP_ACCESS_TOKEN:'test',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_TEMPLATE_NAME:'test',WHATSAPP_GRAPH_VERSION:'v99.0'}:{}
 new Function('require','exports','fetch','process',source)(id=> id==='@/lib/supabaseServer'?{supabaseServer:server}:{gerarLink:async()=> 'https://www.cintiapaulafestaedecoracao.com.br/acompanhar#private-token',hashToken:()=> 'hash'},exports,async(url,options)=>{calls.push({url,options});if(response==='timeout')throw new Error('timeout');return{ok:response===200,status:response,json:async()=>({id:'email-id',messages:[{id:'wa-id'}]})}},{env})
 return {...exports,rows,calls}
}
test('provider acceptance recorded, with private link and email idempotency key',async()=>{
 const f=fixture();await f.enviarAcompanhamento('order','company');assert.equal(f.calls.length,2);assert.ok(f.rows.every(r=>r.status==='aceito'));assert.match(f.calls[0].options.headers['Idempotency-Key'],/^acompanhamento-/);assert.match(f.calls[0].options.body,/#private-token/)
 await f.enviarAcompanhamento('order','company');assert.equal(f.calls.length,2)
})
test('no WhatsApp without explicit consent',async()=>{const f=fixture({consent:false});await f.enviarAcompanhamento('order','company');assert.equal(f.calls.length,1);assert.equal(f.rows.find(r=>r.canal==='whatsapp').status,'sem_consentimento')})
test('missing configuration does not pretend to send',async()=>{const f=fixture({configured:false});await f.enviarAcompanhamento('order','company');assert.equal(f.calls.length,0);assert.ok(f.rows.every(r=>r.status==='nao_configurado'))})
for(const response of [500,'timeout'])test(`uncertain ${response} is not retried`,async()=>{const f=fixture({response});await f.enviarAcompanhamento('order','company');await f.enviarAcompanhamento('order','company');assert.equal(f.calls.length,2);assert.ok(f.rows.every(r=>r.status==='incerto'))})
test('concurrent sends claim each channel once',async()=>{const f=fixture();await Promise.all([f.enviarAcompanhamento('order','company'),f.enviarAcompanhamento('order','company')]);assert.equal(f.calls.length,2)})
