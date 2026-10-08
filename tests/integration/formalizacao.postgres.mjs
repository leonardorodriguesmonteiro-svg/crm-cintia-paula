import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
for (const path of ['../fixtures/formalizacao-schema.sql','../fixtures/formalizacao-dependencies.sql','../../supabase/migrations/20261008195202_jornada3_contrato_pagamento.sql']) {
 await db.exec(readFileSync(new URL(path,import.meta.url),'utf8'))
}
const empresa='11111111-1111-4111-8111-111111111111',usuario='22222222-2222-4222-8222-222222222222'
await db.query("insert into usuarios_empresa(usuario_id,empresa_id,ativo,perfil) values($1,$2,true,'Comercial')",[usuario,empresa])
async function criar(tipo='CONCEITUAL') {
 const q=(await db.query("insert into orcamentos(empresa_id,status,formalizacao_status,dados_cliente_completos_em,cliente_id,data_evento,total,desconto) values($1,'ACEITA','DADOS_COMPLETOS',now(),gen_random_uuid(),'2099-01-10',205.50,10) returning id",[empresa])).rows[0].id
 await db.query("insert into orcamento_itens(orcamento_id,tipo_origem,descricao,quantidade,valor_unitario,preco_unitario_orcamento,desconto,ordem) values($1,$2,'Painel',2,100.10,100.10,10.20,0)",[q,tipo])
 await db.query("insert into orcamento_taxas(orcamento_id,descricao,valor,ordem) values($1,'Montagem',25.50,0)",[q])
 return q
}
async function executar(q,acao='formalizar',sinal=50,user=usuario) {return (await db.query("select executar_formalizacao_servidor($1,$2,$3,$4,'2099-01-01','Pix') as r",[user,q,acao,sinal])).rows[0].r}
const q=await criar();const gerado=await executar(q)
assert.equal(gerado.status,'CONTRATO_GERADO')
const itens=(await db.query('select * from reserva_itens where reserva_id=$1 order by ordem',[gerado.reserva_id])).rows
assert.equal(itens.length,4);assert.match(itens[0].descricao,/conceitual/)
assert.equal(itens.reduce((n,x)=>n+Number(x.subtotal),0),205.50)
assert.equal((await db.query('select status from reservas where id=$1',[gerado.reserva_id])).rows[0].status,'Pendente')
const repetido=await executar(q,'formalizar',99)
assert.equal(repetido.ja_formalizada,true);assert.equal(repetido.contrato_id,gerado.contrato_id)
assert.equal(Number((await db.query('select valor from lancamentos_financeiros where id=$1',[gerado.lancamento_sinal_id])).rows[0].valor),50)
assert.equal((await executar(q,'confirmar_assinatura')).status,'AGUARDANDO_PAGAMENTO')
const confirmado=await executar(q,'confirmar_sinal');assert.equal(confirmado.nova_confirmacao,true);assert.equal(confirmado.status,'RESERVA_CONFIRMADA')
assert.equal((await executar(q,'confirmar_sinal')).nova_confirmacao,false)
assert.equal((await db.query('select count(*)::int as n from recebimentos')).rows[0].n,1)
const livre=await criar('LIVRE');await executar(livre)
assert.equal((await executar(livre,'confirmar_sinal')).status,'AGUARDANDO_ASSINATURA')
assert.equal((await executar(livre,'confirmar_assinatura')).nova_confirmacao,true)
await db.query('update orcamentos set empresa_id=gen_random_uuid() where id=$1',[livre]);await assert.rejects(executar(livre),/permissão/)
const invalido=await criar();await assert.rejects(executar(invalido,'formalizar',999),/maior/)
await db.query('update orcamentos set total=999 where id=$1',[invalido]);await assert.rejects(executar(invalido),/total aceito/)
assert.equal((await db.query('select count(*)::int as n from contratos')).rows[0].n,2)
await db.query("update orcamentos set status='ENVIADA' where id=$1",[invalido]);await assert.rejects(executar(invalido),/aceita/)
console.log('PASS: financial snapshot, conceptual/free items, atomic rollback, tenant authorization, idempotent contract/payment, signature/payment in either order, confirmation event once')
await db.close()
