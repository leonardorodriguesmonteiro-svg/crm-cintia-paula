import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table usuarios_empresa(empresa_id uuid,usuario_id uuid,ativo boolean,perfil text);
create table oportunidades(id uuid primary key,empresa_id uuid,numero integer,etapa text,versao integer default 1,valor_estimado numeric,updated_at timestamptz);
create table kits(id uuid primary key,status text,valor numeric);
create table estoque_itens(id uuid primary key,status text,valor_locacao numeric);
create table oportunidade_itens(id uuid primary key default gen_random_uuid(),empresa_id uuid,oportunidade_id uuid,tipo text,kit_id uuid,estoque_item_id uuid,nome_snapshot text,quantidade numeric,valor_referencia numeric,observacoes text,ordem integer,updated_at timestamptz);
`)
for (const path of ['20260925025727_pre_reserva_valores_desconto.sql','20260925030912_sincronizar_total_pre_reserva.sql','20260925031147_ajustar_autorizacao_desconto_pre_reserva.sql','20261020214311_editar_itens_pre_reserva.sql']) {
  await db.exec(readFileSync(new URL('../../supabase/migrations/' + path, import.meta.url),'utf8'))
}
const empresa='11111111-1111-4111-8111-111111111111', usuario='22222222-2222-4222-8222-222222222222', pedido='33333333-3333-4333-8333-333333333333', kit='44444444-4444-4444-8444-444444444444', linha='55555555-5555-4555-8555-555555555555', estranho='66666666-6666-4666-8666-666666666666'
await db.query("insert into usuarios_empresa values($1,$2,true,'Comercial')",[empresa,usuario])
await db.query("insert into oportunidades(id,empresa_id,numero,etapa) values($1,$2,1,'RECEBIDA')",[pedido,empresa])
await db.query("insert into kits values($1,'Ativo',500)",[kit])
await db.query("insert into oportunidade_itens(id,empresa_id,oportunidade_id,tipo,kit_id,nome_snapshot,quantidade,valor_referencia) values($1,$2,$3,'KIT',$4,'Kit original',1,500)",[linha,empresa,pedido,kit])
await db.exec('grant usage on schema public to service_role; grant all on all tables in schema public to service_role; set role service_role;')
async function snapshot() { return (await db.query('select * from oportunidades where id=$1',[pedido])).rows[0] }
async function salvar(itens,versao,desconto=10,actor=usuario) {
  return (await db.query("select editar_itens_pre_reserva_servidor($1,$2,$3,$4,'PERCENTUAL',$5,$6::jsonb) as resultado",[empresa,pedido,actor,versao,desconto,JSON.stringify(itens)])).rows[0].resultado
}
const itens=[{id:linha,nome_snapshot:'Kit negociado',quantidade:2,valor_referencia:100.10},{tipo:'KIT',kit_id:kit,nome_snapshot:'Outro kit',quantidade:1,valor_referencia:50}]
const inicial=await snapshot()
const salvo=await salvar(itens,inicial.versao)
assert.equal(salvo.total,225.18)
assert.equal((await db.query('select count(*)::int as n from oportunidade_itens')).rows[0].n,2)
assert.equal(Number((await db.query('select valor from kits')).rows[0].valor),500)
await assert.rejects(salvar(itens,inicial.versao),/foi alterada/)
const antes=await snapshot()
await assert.rejects(salvar(itens,antes.versao,110),/desconto invalido/)
assert.deepEqual(await snapshot(),antes)
assert.equal((await db.query('select count(*)::int as n from oportunidade_itens')).rows[0].n,2)
await assert.rejects(salvar([{...itens[0],id:estranho}],antes.versao),/não pertence/)
await assert.rejects(salvar(itens,antes.versao,0,estranho),/sem permissão/)
for (const invalid of [[],[{...itens[0],valor_referencia:null}],[{...itens[0],quantidade:0}],[{...itens[0],valor_referencia:-1}],[{...itens[0],quantidade:1.001}]]) {
  await assert.rejects(salvar(invalid,antes.versao))
  assert.deepEqual(await snapshot(),antes)
}
const gratis=await salvar([{...itens[0],quantidade:1,valor_referencia:0}],antes.versao,0)
assert.equal(gratis.total,0)
assert.equal((await db.query('select count(*)::int as n from oportunidade_itens')).rows[0].n,1)
await db.query("update oportunidades set etapa='RECUSADA' where id=$1",[pedido])
await assert.rejects(salvar(itens,gratis.versao),/não permite/)
await db.exec('reset role; set role authenticated;')
await assert.rejects(salvar(itens,gratis.versao),/permission denied/)
console.log('PASS: SQL real sob service_role, editar/adicionar/remover, preço zero, desconto, catálogo intacto, versão obsoleta, rollback e autorização')
await db.close()
