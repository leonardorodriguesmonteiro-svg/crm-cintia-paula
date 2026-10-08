import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calcularOrcamento3,
  podeTransicionarOrcamento3
} from '../lib/domain/comercial/orcamento3.ts'

test('calcula preço negociado, desconto percentual e taxas sem alterar preço-base', () => {
  const resultado = calcularOrcamento3({
    itens: [
      { quantidade: 2, precoUnitarioOrcamento: 85, tipoOrigem: 'ESTOQUE' },
      { quantidade: 1, precoUnitarioOrcamento: 130, desconto: 10, tipoOrigem: 'KIT' }
    ],
    taxas: [{ valor: 30 }, { valor: 20 }],
    descontoTipo: 'PERCENTUAL',
    descontoValor: 10
  })

  assert.deepEqual(resultado, {
    valido: true,
    erros: [],
    subtotal: 290,
    descontoCalculado: 29,
    totalTaxas: 50,
    totalFinal: 311,
    possuiItemConceitual: false
  })
})

test('sinaliza item conceitual sem tratá-lo como disponibilidade de estoque', () => {
  const resultado = calcularOrcamento3({
    itens: [
      { quantidade: 1, precoUnitarioOrcamento: 250, tipoOrigem: 'CONCEITUAL' }
    ]
  })

  assert.equal(resultado.valido, true)
  assert.equal(resultado.possuiItemConceitual, true)
  assert.equal(resultado.totalFinal, 250)
})

test('recusa descontos e valores inválidos', () => {
  const percentual = calcularOrcamento3({
    itens: [{ quantidade: 1, precoUnitarioOrcamento: 100 }],
    descontoTipo: 'PERCENTUAL',
    descontoValor: 101
  })
  const item = calcularOrcamento3({
    itens: [{ quantidade: 1, precoUnitarioOrcamento: 100, desconto: 101 }]
  })

  assert.equal(percentual.valido, false)
  assert.ok(percentual.erros.includes('PERCENTUAL_DESCONTO_INVALIDO'))
  assert.equal(item.valido, false)
  assert.ok(item.erros.includes('ITEM_1_DESCONTO_MAIOR_QUE_SUBTOTAL'))
})

test('orçamento finalizado pode voltar para edição, mas cancelado é terminal', () => {
  assert.equal(podeTransicionarOrcamento3('NOVO', 'EM_EDICAO'), true)
  assert.equal(podeTransicionarOrcamento3('NOVO', 'FINALIZADO'), false)
  assert.equal(podeTransicionarOrcamento3('FINALIZADO', 'EM_EDICAO'), true)
  assert.equal(podeTransicionarOrcamento3('CANCELADO', 'EM_EDICAO'), false)
})
