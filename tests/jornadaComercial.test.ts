import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calcularAjusteComercial,
  pendenciasParaConfirmarReserva,
  podeConfirmarReserva,
  podeTransicionarPreReserva,
  proximosStatusPreReserva,
  statusAposContratoEPagamento
} from '../lib/domain/comercial/jornadaComercial.ts'

test('o ajuste comercial calcula desconto em reais e percentual sobre o catálogo', () => {
  assert.deepEqual(
    calcularAjusteComercial({ subtotal: 500, tipo: 'VALOR', valor: 50 }),
    { valido: true, descontoCalculado: 50, total: 450 }
  )
  assert.deepEqual(
    calcularAjusteComercial({ subtotal: 500, tipo: 'PERCENTUAL', valor: 10 }),
    { valido: true, descontoCalculado: 50, total: 450 }
  )
  assert.equal(
    calcularAjusteComercial({ subtotal: 500, tipo: 'VALOR', valor: 501 }).valido,
    false
  )
  assert.equal(
    calcularAjusteComercial({ subtotal: 500, tipo: 'PERCENTUAL', valor: 101 }).valido,
    false
  )
})

test('a pré-reserva segue apenas as transições oficiais', () => {
  assert.deepEqual(proximosStatusPreReserva('RECEBIDA'), ['EM_ANALISE', 'RECUSADA'])
  assert.equal(podeTransicionarPreReserva('RECEBIDA', 'APROVADA'), false)
  assert.equal(podeTransicionarPreReserva('EM_ANALISE', 'APROVADA'), true)
  assert.equal(podeTransicionarPreReserva('CONVERTIDA_EM_PROPOSTA', 'EM_ANALISE'), false)
})

test('contrato e sinal determinam um único estado de formalização', () => {
  assert.equal(
    statusAposContratoEPagamento({ contratoAssinado: false, pagamentoConfirmado: false }),
    'AGUARDANDO_ASSINATURA'
  )
  assert.equal(
    statusAposContratoEPagamento({ contratoAssinado: true, pagamentoConfirmado: false }),
    'AGUARDANDO_PAGAMENTO'
  )
  assert.equal(
    statusAposContratoEPagamento({ contratoAssinado: false, pagamentoConfirmado: true }),
    'AGUARDANDO_ASSINATURA'
  )
  assert.equal(
    statusAposContratoEPagamento({ contratoAssinado: true, pagamentoConfirmado: true }),
    'RESERVA_CONFIRMADA'
  )
})

test('a reserva só pode ser confirmada com todos os requisitos concluídos', () => {
  const requisitos = {
    propostaAceita: true,
    dadosClienteCompletos: true,
    contratoAssinado: true,
    pagamentoConfirmado: true,
    disponibilidadeValida: true,
    reservaExistente: false
  }

  assert.deepEqual(pendenciasParaConfirmarReserva(requisitos), [])
  assert.equal(podeConfirmarReserva(requisitos), true)
  assert.deepEqual(
    pendenciasParaConfirmarReserva({ ...requisitos, pagamentoConfirmado: false }),
    ['PAGAMENTO_NAO_CONFIRMADO']
  )
})
