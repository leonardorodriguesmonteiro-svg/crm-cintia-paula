import assert from 'node:assert/strict'
import test from 'node:test'
import { calcularEditor, serializarEditor, validarEditor, type ItemEditor, type TaxaEditor } from '../lib/comercial/orcamentoEditor.ts'
import { orcamento3DoCorpo } from '../lib/server/orcamento3Request.ts'
import { salvarOrcamento3 } from '../lib/application/comercial/orcamento3Application.ts'

const item: ItemEditor = { chave: 'linha1', tipo_origem: 'LIVRE', kit_id: '', estoque_item_id: '', item_conceitual_id: '', descricao: 'Painel livre', quantidade: '2', valor_unitario: '100.10', preco_base: 120, desconto: '10.20', observacao: ' personalizado ' }
const taxa: TaxaEditor = { chave: 'taxa1', descricao: ' Montagem ', tipo: 'MONTAGEM', valor: '25.50', observacao: '' }
const identidade = { empresaId: '11111111-1111-4111-8111-111111111111', usuarioId: '22222222-2222-4222-8222-222222222222', idempotenciaCabecalho: 'editor-teste' }

test('total do editor combina preço negociado, desconto por item, percentual e taxas', () => {
  const calculo = calcularEditor([item], [taxa], 'PERCENTUAL', '10')
  assert.equal(calculo.subtotal, 190)
  assert.equal(calculo.descontoCalculado, 19)
  assert.equal(calculo.totalTaxas, 25.50)
  assert.equal(calculo.totalFinal, 196.50)
  assert.equal(calculo.valido, true)
})

test('não descarta linhas incompletas e não transforma preço vazio em grátis', () => {
  assert.ok(validarEditor([{ ...item, descricao: '' }], [], 'VALOR', 0))
  assert.ok(validarEditor([{ ...item, valor_unitario: '' }], [], 'VALOR', 0))
  assert.ok(validarEditor([item], [{ ...taxa, valor: '' }], 'VALOR', 0))
  assert.ok(validarEditor([{ ...item, desconto: 201 }], [], 'VALOR', 0))
  assert.ok(validarEditor([item], [], 'PERCENTUAL', 101))
  assert.ok(validarEditor([item], [{ ...taxa, valor: -1 }], 'VALOR', 0))
  assert.equal(validarEditor([{ ...item, valor_unitario: 0, desconto: 0 }], [], 'VALOR', 0), null)
})

test('payload do editor atravessa o parser e a aplicação preservando valores e referências', async () => {
  const conceito: ItemEditor = { ...item, chave: 'conceito', tipo_origem: 'CONCEITUAL', item_conceitual_id: '33333333-3333-4333-8333-333333333333', quantidade: 1, valor_unitario: 80, desconto: 0 }
  const corpo = { ...serializarEditor([item, conceito], [taxa]), status: 'EM_EDICAO', desconto_tipo: 'PERCENTUAL', desconto_valor: 10, validade: '2027-01-10', oportunidade_id: null }
  const entrada = orcamento3DoCorpo(corpo, identidade)
  assert.equal(entrada.itens[0].precoUnitarioOrcamento, 100.10)
  assert.equal(entrada.itens[0].precoBase, 120)
  assert.equal(entrada.itens[0].observacao, 'personalizado')
  assert.equal(entrada.itens[1].itemConceitualId, conceito.item_conceitual_id)
  assert.equal(entrada.taxas?.[0].descricao, 'Montagem')
  assert.equal(entrada.validade, '2027-01-10')
  let persistiu = false
  await salvarOrcamento3(entrada, {
    salvar: async input => {
      persistiu = true
      assert.deepEqual(input, entrada)
      return { id: '44444444-4444-4444-8444-444444444444', numero: 1, status_anterior: null, status: 'EM_EDICAO', versao: 1, subtotal: 270, desconto: 27, total_taxas: 25.5, total: 268.5, criado: true, alterado: true, possui_item_conceitual: true }
    },
    publicar: async () => ({ sucesso: true, erros: [] })
  })
  assert.equal(persistiu, true)
})

test('edição usa versão e criação usa chave de idempotência do cabeçalho', () => {
  const entrada = orcamento3DoCorpo({ versao: 7, ...serializarEditor([item], []), desconto_tipo: 'PERCENTUAL', desconto_valor: 15 }, { ...identidade, orcamentoId: '44444444-4444-4444-8444-444444444444' })
  assert.equal(entrada.versaoEsperada, 7)
  assert.equal(entrada.idempotencia, 'editor-teste')
  assert.equal(entrada.descontoTipo, 'PERCENTUAL')
  assert.equal(entrada.descontoValor, 15)
  assert.equal(entrada.oportunidadeId, undefined)
})
