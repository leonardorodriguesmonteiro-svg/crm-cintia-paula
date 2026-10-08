import assert from 'node:assert/strict'
import test from 'node:test'
import { linkContratoDaProposta, contatoDaProposta, propostaPodeEnviar, propostaVisivelAoCliente, valoresItemPublico } from '../lib/domain/comercial/propostaPublica.ts'
import { executarEnvioPropostaEmail } from '../lib/application/comercial/envioPropostaEmail.ts'

test('envio aceita finalizado e legado, mas não orçamento em edição ou respondido', () => {
  for (const status of ['RASCUNHO','FINALIZADO','ENVIADA']) assert.equal(propostaPodeEnviar(status), true)
  for (const status of ['NOVO','EM_EDICAO','CANCELADO','CANCELADA','ACEITA','RECUSADA','EXPIRADA']) assert.equal(propostaPodeEnviar(status), false)
  assert.equal(propostaPodeEnviar('ENVIADA','ACEITA'), false)
})
test('link público oculta rascunhos e orçamento com envio cancelado', () => {
  for (const status of ['NOVO','EM_EDICAO','FINALIZADO','RASCUNHO','Rascunho','CANCELADO','CANCELADA']) assert.equal(propostaVisivelAoCliente(status), false)
  for (const status of ['ENVIADA','ACEITA','RECUSADA','EXPIRADA','Enviado','Aprovado']) assert.equal(propostaVisivelAoCliente(status), true)
})
test('proposta mostra preço negociado e desconto por linha, inclusive preço zero', () => {
  assert.deepEqual(valoresItemPublico({ quantidade: 2, valor_unitario: 120, preco_unitario_orcamento: 100, subtotal: 240, subtotal_negociado: 180, desconto: 20 }), { quantidade: 2, valor_unitario: 100, subtotal: 180, desconto: 20 })
  assert.equal(valoresItemPublico({ quantidade: 1, valor_unitario: 120, preco_unitario_orcamento: 0, subtotal: 120, subtotal_negociado: 0 }).subtotal, 0)
  assert.equal(valoresItemPublico({ quantidade: 1, valor_unitario: 120, subtotal: 120 }).subtotal, 120)
})
test('contato do orçamento direto tem prioridade sobre cadastro antigo', () => {
  assert.deepEqual(contatoDaProposta({ contato_nome:' Ana ', contato_email:' ANA@EXAMPLE.COM ' },{ nome:'Antigo',email:'antigo@example.com' }),{ nome:'Ana',email:'ana@example.com' })
  assert.equal(contatoDaProposta({}, { nome:'Legado',email:'legado@example.com' }).email, 'legado@example.com')
})
test('falha de configuração ou destinatário não publica nem envia', async () => {
  let chamadas = 0
  await assert.rejects(executarEnvioPropostaEmail({ preparar: async () => { throw new Error('Configuração ausente') }, disponibilizar: async () => { chamadas++ }, enviar: async () => { chamadas++ } }), /Configuração ausente/)
  assert.equal(chamadas, 0)
})
test('falha na liberação não chama o provedor de e-mail', async () => {
  let envios = 0
  await assert.rejects(executarEnvioPropostaEmail({ preparar: async () => {}, disponibilizar: async () => { throw new Error('Proposta expirada') }, enviar: async () => { envios++ } }), /Proposta expirada/)
  assert.equal(envios, 0)
})
test('envio só ocorre depois da validação e liberação', async () => {
  const ordem: string[] = []
  const resultado = await executarEnvioPropostaEmail({ preparar: async () => { ordem.push('preparar') }, disponibilizar: async () => { ordem.push('disponibilizar') }, enviar: async () => { ordem.push('enviar'); return { sucesso: true } } })
  assert.deepEqual(ordem, ['preparar','disponibilizar','enviar'])
  assert.equal(resultado.sucesso, true)
})

test('contrato público só aparece para proposta aceita e reserva correspondente', () => {
  const proposta = { status: 'ACEITA', reserva_id: 'reserva-1' }
  const contrato = { public_token: 'token', status: 'Gerado', reserva_id: 'reserva-1' }
  assert.equal(linkContratoDaProposta(proposta, contrato), '/contrato/token')
  assert.equal(linkContratoDaProposta({ ...proposta, status: 'ENVIADA' }, contrato), null)
  assert.equal(linkContratoDaProposta(proposta, { ...contrato, status: 'Cancelado' }), null)
  assert.equal(linkContratoDaProposta(proposta, { ...contrato, reserva_id: 'outra' }), null)
  assert.equal(linkContratoDaProposta(proposta, null), null)
})
