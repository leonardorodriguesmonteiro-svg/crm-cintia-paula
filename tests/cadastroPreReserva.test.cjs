const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const { NextRequest, NextResponse } = require('next/server')
const crypto = require('node:crypto')
function load(path, mocks) { const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>mocks[id]||{},exports);return exports }
class JornadaComercialError extends Error {}
const {validarCadastroCliente}=load('lib/application/comercial/dadosClientePropostaApplication.ts',{'./jornadaComercialApplication':{JornadaComercialError}})
const valido={token:'a'.repeat(43),cpf:'52998224725',cep:'20040020',endereco:'Rua de teste',numero:'123',complemento:'',bairro:'Centro',cidade:'Rio de Janeiro',estado:'rj',email:'TEST@example.com'}
test('cadastro validates CPF, address and email before any write',()=>{
 assert.equal(validarCadastroCliente(valido).estado,'RJ');assert.equal(validarCadastroCliente(valido).email,'test@example.com')
 for(const [k,v] of [['cpf','11111111111'],['cpf','52998224726'],['cep','123'],['email','invalid'],['estado','XX'],['endereco',''],['numero',''],['bairro',''],['cidade','']])assert.throws(()=>validarCadastroCliente({...valido,[k]:v}))
})
test('cadastro aceita CPF e CNPJ validos e rejeita documentos invalidos',()=>{
 const cnpj='11222333000181'
 assert.equal(validarCadastroCliente({...valido,cpf:cnpj}).cpf,cnpj)
 assert.equal(validarCadastroCliente({...valido,cpf:'11.222.333/0001-81'}).cpf,cnpj)
 assert.equal(validarCadastroCliente({...valido,cpf:'529.982.247-25'}).cpf,'52998224725')
 for(const documento of ['00000000000000','11222333000182','12345678901234','11111111111']) {
   assert.throws(()=>validarCadastroCliente({...valido,cpf:documento}))
 }
})

function fixture({origin=true,rate=true,error=null}={}){
 const calls=[]
 const route=load('app/api/publico/acompanhamento/cadastro/route.ts',{
  'next/server':{NextRequest,NextResponse},
  '@/lib/server/acompanhamento':{tokenValido:t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t),hashToken:t=>crypto.createHash('sha256').update(t).digest('hex')},
  '@/lib/server/publicPreReservation':{empresaDoSite:()=> 'company',hashDoSolicitante:()=> 'ip',origemEhPermitida:()=> origin},
  '@/lib/repositories/comercialJourneyRepository':{comercialJourneyRepository:{consumirLimitePublico:async()=>rate}},
  '@/lib/application/comercial/dadosClientePropostaApplication':{validarCadastroCliente},
  '@/lib/application/comercial/jornadaComercialApplication':{JornadaComercialError},
  '@/lib/supabaseServer':{supabaseServer:{rpc:async(name,args)=>{calls.push({name,args});return{data:{sucesso:true},error}}}}
 })
 return{calls,run:body=>route.POST(new NextRequest('https://www.cintiapaulafestaedecoracao.com.br/api/publico/acompanhamento/cadastro',{method:'POST',body:JSON.stringify(body)}))}
}
test('private intake sends hashed token and configured company, not user supplied ids',async()=>{
 const f=fixture();const r=await f.run({...valido,empresa_id:'other',cliente_id:'victim'});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(f.calls[0].args.p_empresa_id,'company');assert.notEqual(f.calls[0].args.p_token_hash,valido.token);assert.equal(f.calls[0].args.p_dados.cliente_id,undefined)
})
test('intake blocks missing token, bad origin, rate excess and invalid CPF before write',async()=>{
 for(const [options,body,status] of [[{}, {...valido,token:'15'},400],[{origin:false},valido,403],[{rate:false},valido,429],[{},{...valido,cpf:'123'},400]]){const f=fixture(options);assert.equal((await f.run(body)).status,status);assert.equal(f.calls.length,0)}
})
test('intake hides database failures but explains invalid lifecycle',async()=>{
 const f=fixture({error:{code:'internal',message:'sensitive schema'}});assert.doesNotMatch(JSON.stringify(await(await f.run(valido)).json()),/sensitive/)
 const g=fixture({error:{code:'22023',message:'Link inválido ou expirado.'}});assert.equal((await g.run(valido)).status,409)
})
