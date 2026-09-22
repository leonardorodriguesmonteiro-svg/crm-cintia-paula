const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const ts = require('typescript')
const crypto = require('node:crypto')
const { NextRequest, NextResponse } = require('next/server')
const token = crypto.randomBytes(32).toString('base64url')
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
function moduleWithMocks(path, mocks) {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('require', 'exports', source)(id => id in mocks ? mocks[id] : require(id), exports)
  return exports
}
function fixture(options = {}) {
  const rows = {
    acompanhamento_links: [{ oportunidade_id: 'order-1', token_hash: digest(token), revoked_at: null, expires_at: '2099-01-01', ...options.link }],
    oportunidades: [{ id: 'order-1', empresa_id: 'company-1', numero: 15, etapa: 'RECEBIDA', data_evento: '2026-10-12', email: 'secret@example.com', ...options.order }],
    orcamentos: options.proposals || [], reservas: [], contratos: []
  }
  let calls = 0
  const server = { from(table) {
    calls++
    let result = rows[table] || []
    const q = {
      select() { return q },
      eq(key, value) { result = result.filter(r => r[key] === value); return q },
      neq(key, value) { result = result.filter(r => r[key] !== value); return q },
      is(key, value) { result = result.filter(r => r[key] === value); return q },
      gt(key, value) { result = result.filter(r => r[key] > value); return q },
      order() { return q }, limit(n) { result = result.slice(0,n); return q },
      async maybeSingle() { return { data: result[0] || null, error: options.dbError ? { message: 'private db error' } : null } }
    }; return q
  } }
  const route = moduleWithMocks('app/api/publico/acompanhamento/route.ts', {
    '@/lib/server/acompanhamento': { hashToken: digest, tokenValido: t => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t) },
    '@/lib/server/publicPreReservation': { empresaDoSite: () => 'company-1', hashDoSolicitante: () => 'ip-hash', origemEhPermitida: () => options.origin !== false },
    '@/lib/repositories/comercialJourneyRepository': { comercialJourneyRepository: { consumirLimitePublico: async () => options.rate !== false } },
    '@/lib/supabaseServer': { supabaseServer: server }
  })
  return { calls: () => calls, run: value => route.POST(new NextRequest('https://www.cintiapaulafestaedecoracao.com.br/api/publico/acompanhamento', { method:'POST', body: JSON.stringify({ token: value }) })) }
}
test('order number alone cannot access data', async () => { const f = fixture(); assert.equal((await f.run('15')).status,404); assert.equal(f.calls(),0) })
test('valid bearer returns only explicit customer fields and never contact data', async () => {
  const r = await fixture().run(token); assert.equal(r.status,200)
  assert.match(r.headers.get('cache-control'),/no-store/)
  const body = await r.json(); assert.equal(body.numero,15); assert.equal(body.email,undefined); assert.equal(body.id,undefined); assert.equal(body.empresa_id,undefined)
})
for (const [name, link] of [['revoked',{revoked_at:'2026-01-01'}],['expired',{expires_at:'2000-01-01'}],['unknown',{token_hash:'0'.repeat(64)}]]) {
  test(`${name} token cannot access an order`, async () => assert.equal((await fixture({link}).run(token)).status,404))
}
test('cross-company order denied', async () => assert.equal((await fixture({order:{empresa_id:'other'}}).run(token)).status,404))
test('draft proposal is not disclosed', async () => {
  const r = await fixture({proposals:[{ oportunidade_id:'order-1',empresa_id:'company-1',status:'RASCUNHO',public_token:'private-draft' }]}).run(token)
  assert.equal((await r.json()).proposta,null)
})
test('cross-company proposal is not disclosed', async () => {
  const r = await fixture({proposals:[{ oportunidade_id:'order-1',empresa_id:'other',status:'ENVIADA',public_token:'other-secret' }]}).run(token)
  assert.equal((await r.json()).proposta,null)
})
test('rate limit and origin deny before database read', async () => {
  for (const [options,status] of [[{rate:false},429],[{origin:false},403]]) { const f=fixture(options); assert.equal((await f.run(token)).status,status);assert.equal(f.calls(),0) }
})
test('database errors remain generic',async () => { const r=await fixture({dbError:true}).run(token);assert.equal(r.status,503);assert.doesNotMatch(JSON.stringify(await r.json()),/private db error/) })
test('issued token is random, hashed and not embedded in HTTP path', async () => {
  let saved
  process.env.ACOMPANHAMENTO_ENCRYPTION_KEY = 'test-key-not-a-real-secret'
  const { gerarLink, decifrarToken } = moduleWithMocks('lib/server/acompanhamento.ts', {
    '@/lib/supabaseServer': { supabaseServer:{from(table){
      if(table==='acompanhamento_links') { const q = {select(){return q},eq(){return q},maybeSingle:async()=>({data:saved || null,error:null}),insert: async r => {saved=r;return {error:null}}}; return q }
      const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{id:'order-1'},error:null})};return q
    }}}
  })
  const url=new URL(await gerarLink('order-1','company-1'));assert.equal(url.pathname,'/acompanhar');assert.equal(url.hash.length,44)
  assert.equal(saved.token_hash,digest(url.hash.slice(1)));assert.equal(saved.token,undefined)
  assert.notEqual(saved.token_cifrado,url.hash.slice(1))
  assert.equal(decifrarToken(saved.token_cifrado,'order-1'),url.hash.slice(1))
  assert.throws(()=>decifrarToken(saved.token_cifrado,'other-order'))
  assert.equal(await gerarLink('order-1','company-1'),url.href)
  saved.revoked_at = new Date().toISOString()
  await assert.rejects(()=>gerarLink('order-1','company-1'),/revogado/)
  saved.revoked_at = null; saved.token_cifrado = null
  await assert.rejects(()=>gerarLink('order-1','company-1'),/antigo/)
})
test('approved pre-reservation offers intake; completed and legacy sent proposals do not', async () => {
 const pending=await(await fixture({order:{etapa:'APROVADA'}}).run(token)).json();assert.equal(pending.cadastro.disponivel,true)
 const complete=await(await fixture({order:{etapa:'APROVADA',cadastro_completo_em:'2026-09-22'}}).run(token)).json();assert.deepEqual(complete.cadastro,{completo:true,disponivel:false})
 const legacy=await(await fixture({order:{etapa:'CONVERTIDA_EM_PROPOSTA'},proposals:[{oportunidade_id:'order-1',empresa_id:'company-1',status:'ENVIADA'}]}).run(token)).json();assert.equal(legacy.cadastro.disponivel,false)
})
