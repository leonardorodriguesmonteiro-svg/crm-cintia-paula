const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const ts = require('typescript')
const { NextRequest, NextResponse } = require('next/server')
function fixture({ authError, dbError } = {}) {
  const calls = []
  const mocks = {
    'next/server': { NextRequest, NextResponse },
    '@/lib/server/adminAuth': {
      exigirPerfis: async () => { if (authError) throw authError; return { usuario: { id: 'actor' }, vinculo: { empresa_id: 'company' } } },
      respostaErroAdministrativo: e => ({ mensagem: e.message, status: e.status || 400 })
    },
    '@/lib/application/comercial/jornadaComercialApplication': {
      JornadaComercialError: class extends Error {},
      ajustarValoresPreReserva: async input => { calls.push(input); if (dbError) throw dbError; return { total: 180 } }
    }
  }
  const exports = {}
  new Function('require','exports',ts.transpileModule(readFileSync('app/api/comercial/pre-reservas/[id]/valores/route.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(id => mocks[id],exports)
  return { calls, run: body => exports.PATCH(new NextRequest('https://example.com/api/comercial/pre-reservas/order/valores', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'order' }) }) }
}
const body = { versao: 5, desconto_tipo: 'VALOR', desconto_valor: 20, itens: [{ id: 'line', quantidade: 2, valor_referencia: 100, nome_snapshot: 'Item editado' }] }
test('edição encaminha itens e usa identidade autenticada, não a enviada pelo cliente', async () => {
  const f = fixture(); assert.equal((await f.run({ ...body, empresaId: 'other', usuarioId: 'other' })).status,200)
  assert.deepEqual(f.calls[0], { itens: body.itens, empresaId: 'company', usuarioId: 'actor', oportunidadeId: 'order', versaoEsperada: 5, descontoTipo: 'VALOR', descontoValor: 20 })
})
test('edição sem sessão e itens em formato inválido não chega à aplicação', async () => {
  const f=fixture({ authError: { message: 'Sessão inválida', status: 401 } }); assert.equal((await f.run(body)).status,401); assert.equal(f.calls.length,0)
  const g=fixture(); assert.equal((await g.run({ ...body, itens: {} })).status,400); assert.equal(g.calls.length,0)
})
test('conflito e acesso a item alheio retornam respostas explícitas', async () => {
  for (const [code,status] of [['40001',409],['42501',403],['P0002',404],['22023',400],['23514',400]]) {
    assert.equal((await fixture({ dbError: { code, message: 'Revise o pedido' } }).run(body)).status,status)
  }
})
test('falhas internas não expõem detalhes do banco', async () => {
  const r=await fixture({ dbError: { code: 'XX000', message: 'private database details' } }).run(body)
  assert.equal(r.status,500); assert.doesNotMatch(JSON.stringify(await r.json()),/private database/)
})
