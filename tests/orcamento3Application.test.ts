import assert from 'node:assert/strict'
import test from 'node:test'
import {
  Orcamento3Error,
  salvarOrcamento3
} from '../lib/application/comercial/orcamento3Application.ts'
import type {
  Orcamento3Persistido,
  SalvarOrcamento3Input
} from '../lib/application/comercial/orcamento3.types.ts'

const empresaId = '11111111-1111-4111-8111-111111111111'
const usuarioId = '22222222-2222-4222-8222-222222222222'

function entrada(
  parcial: Partial<SalvarOrcamento3Input> = {}
): SalvarOrcamento3Input {
  return {
    empresaId,
    usuarioId,
    idempotencia: 'teste:orcamento:1',
    status: 'EM_EDICAO',
    origem: 'MANUAL',
    contatoNome: 'Cliente Teste',
    contatoTelefone: '21999999999',
    dataEvento: '2027-02-10',
    itens: [{
      tipoOrigem: 'LIVRE',
      descricao: 'Painel personalizado',
      quantidade: 1,
      precoBase: 200,
      precoUnitarioOrcamento: 180
    }],
    taxas: [],
    ...parcial
  }
}

function persistido(
  parcial: Partial<Orcamento3Persistido> = {}
): Orcamento3Persistido {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    numero: 25,
    status_anterior: null,
    status: 'EM_EDICAO',
    versao: 1,
    subtotal: 180,
    desconto: 0,
    total_taxas: 0,
    total: 180,
    criado: true,
    alterado: true,
    possui_item_conceitual: false,
    ...parcial
  }
}

test('salva o orçamento pela camada de aplicação e publica o evento comercial', async () => {
  const eventos: unknown[] = []
  const resultado = await salvarOrcamento3(entrada(), {
    salvar: async () => persistido(),
    publicar: async evento => {
      eventos.push(evento)
      return { sucesso: true, erros: [] }
    }
  })

  assert.equal(resultado.criado, true)
  assert.equal(resultado.total, 180)
  assert.equal(eventos.length, 1)
  assert.equal((eventos[0] as { codigo: string }).codigo, 'ORCAMENTO_CRIADO')
})

test('não duplica evento quando a criação é repetida com a mesma idempotência', async () => {
  let eventos = 0
  const resultado = await salvarOrcamento3(entrada(), {
    salvar: async () => persistido({ criado: false, alterado: false }),
    publicar: async () => {
      eventos += 1
      return { sucesso: true, erros: [] }
    }
  })

  assert.equal(resultado.alterado, false)
  assert.equal(eventos, 0)
})

test('exige dados mínimos antes de finalizar o orçamento', async () => {
  await assert.rejects(
    salvarOrcamento3(entrada({
      status: 'FINALIZADO',
      contatoTelefone: null,
      itens: []
    }), {
      salvar: async () => persistido(),
      publicar: async () => ({ sucesso: true, erros: [] })
    }),
    (error: unknown) => error instanceof Orcamento3Error
      && error.codigo === 'DADOS_FINALIZACAO_INCOMPLETOS'
  )
})

test('traduz conflito de concorrência para resposta HTTP 409', async () => {
  await assert.rejects(
    salvarOrcamento3(entrada({
      orcamentoId: '33333333-3333-4333-8333-333333333333',
      versaoEsperada: 1
    }), {
      salvar: async () => {
        throw { code: '40001', message: 'serialization failure' }
      },
      publicar: async () => ({ sucesso: true, erros: [] })
    }),
    (error: unknown) => error instanceof Orcamento3Error
      && error.codigo === 'CONFLITO_DE_VERSAO'
      && error.statusHttp === 409
  )
})
