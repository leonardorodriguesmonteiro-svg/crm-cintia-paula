const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const { NextRequest } = require('next/server')
const mod = { exports: {} }
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../proxy.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('require', 'exports', 'module', code)(require, mod.exports, mod)
const request = pathname => new NextRequest(`https://www.cintiapaulafestaedecoracao.com.br${pathname}`)
test('domínio público serve os arquivos da marca sem redirecionar para HTML', () => {
  for (const pathname of ['/brand/cintia-paula.jpg', '/brand/decoracao-borboletas.webp']) {
    const response = mod.exports.proxy(request(pathname))
    assert.equal(response.headers.get('x-middleware-next'), '1')
    assert.equal(response.headers.get('location'), null)
  }
})
test('liberação das imagens mantém o bloqueio das páginas internas no site público', () => {
  for (const pathname of ['/reservas', '/administracao', '/brand/arquivo-privado']) {
    assert.equal(mod.exports.proxy(request(pathname)).headers.get('location'), 'https://www.cintiapaulafestaedecoracao.com.br/')
  }
})
