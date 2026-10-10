import assert from 'node:assert/strict'
import test from 'node:test'
import { origemPublicaJornada } from '../lib/origemPublicaJornada.ts'

test('links oficiais mantêm domínio público de produção', () => {
  assert.equal(origemPublicaJornada('https://erp.cintiapaulafestaedecoracao.com.br'), 'https://www.cintiapaulafestaedecoracao.com.br')
})
test('homologação e deployments mantêm o próprio ambiente', () => {
  for (const origem of ['https://crm-cintia-paula-homologacao.vercel.app', 'https://crm-cintia-paula-homologacao-2iezdf0ro-crm-festas.vercel.app', 'https://crm-cintia-paula-v3-supabase-ph81qp2kx-crm-festas.vercel.app', 'http://localhost:3000']) assert.equal(origemPublicaJornada(origem), origem)
})
test('origens externas e domínios semelhantes são recusados', () => {
  for (const origem of ['https://evil.example', 'https://crm-cintia-paula-homologacao.vercel.app.evil.example', 'http://erp.cintiapaulafestaedecoracao.com.br', 'https://outro-crm-festas.vercel.app']) assert.throws(() => origemPublicaJornada(origem))
})
