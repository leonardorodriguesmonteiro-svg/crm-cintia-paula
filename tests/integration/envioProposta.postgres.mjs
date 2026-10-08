import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table usuarios_empresa(usuario_id uuid, empresa_id uuid, ativo boolean, perfil text);
create table oportunidades(id uuid,empresa_id uuid,etapa text,versao integer default 1,nome_contato text,celular text,email text,origem text,cliente_id uuid);
create table clientes(id uuid default gen_random_uuid(),nome text,cpf text unique,whatsapp text,email text,cep text,endereco text,numero text,complemento text,bairro text,cidade text,estado text,origem text,status text,observacoes text,created_at timestamptz default now(),updated_at timestamptz);
create table orcamento_itens(orcamento_id uuid);
create table orcamentos(id uuid default gen_random_uuid(),empresa_id uuid,numero serial,oportunidade_id uuid,status text,public_token uuid default gen_random_uuid(),versao integer default 1,resposta_cliente text,reserva_id uuid,validade date,contato_nome text,contato_telefone text,data_evento date,email_enviado_em timestamptz,email_destino text,email_erro text,cliente_id uuid,contato_email text,origem text,dados_cliente_completos_em timestamptz,formalizacao_status text);
`)
await db.exec(readFileSync(new URL('../../supabase/migrations/20261008191126_jornada3_envio_proposta.sql', import.meta.url),'utf8'))
const empresa='11111111-1111-4111-8111-111111111111', usuario='22222222-2222-4222-8222-222222222222'
await db.query("insert into usuarios_empresa values($1,$2,true,'Comercial')",[usuario,empresa])
async function criar(status, oportunidade=null, validade='2099-01-01') {
 const row=(await db.query("insert into orcamentos(empresa_id,status,oportunidade_id,contato_nome,contato_telefone,data_evento,validade) values($1,$2,$3,'Cliente teste','11999999999','2099-01-10',$4) returning *",[empresa,status,oportunidade,validade])).rows[0]
 await db.query('insert into orcamento_itens values($1)',[row.id]); return row
}
async function enviar(id, tenant=empresa) { return (await db.query('select enviar_proposta_servidor($1,$2,$3) as resultado',[usuario,tenant,id])).rows[0].resultado }
async function cancelar(id) { return (await db.query('select cancelar_envio_proposta_servidor($1,$2,$3) as resultado',[usuario,empresa,id])).rows[0].resultado }
const novo=await criar('FINALIZADO')
const envio=await enviar(novo.id)
assert.equal(envio.status,'ENVIADA');assert.equal(envio.ja_enviada,false)
assert.equal((await enviar(novo.id)).ja_enviada,true)
assert.equal((await db.query('select versao from orcamentos where id=$1',[novo.id])).rows[0].versao,2)
assert.equal((await cancelar(novo.id)).status,'EM_EDICAO')
let reaberto=(await db.query('select * from orcamentos where id=$1',[novo.id])).rows[0]
assert.notEqual(reaberto.public_token,envio.public_token)
await assert.rejects(enviar(novo.id),/Finalize/)
await db.query("update orcamentos set status='FINALIZADO' where id=$1",[novo.id])
assert.equal((await enviar(novo.id)).public_token,reaberto.public_token)
await db.query("update orcamentos set resposta_cliente='ACEITA',status='ACEITA' where id=$1",[novo.id])
await assert.rejects(cancelar(novo.id),/sem resposta/)
await assert.rejects(enviar(novo.id),/respondida/)
const vencido=await criar('FINALIZADO',null,'2000-01-01');await assert.rejects(enviar(vencido.id),/expirada/)
const rascunho=await criar('EM_EDICAO');await assert.rejects(enviar(rascunho.id),/Finalize/)
await assert.rejects(enviar(rascunho.id,'33333333-3333-4333-8333-333333333333'),/permissão/)
const oportunidade='44444444-4444-4444-8444-444444444444'
await db.query("insert into oportunidades(id,empresa_id,etapa) values($1,$2,'APROVADA')",[oportunidade,empresa])
const legado=await criar('RASCUNHO',oportunidade)
assert.equal((await enviar(legado.id)).status,'ENVIADA')
assert.equal((await cancelar(legado.id)).status,'RASCUNHO')
assert.equal((await db.query('select etapa from oportunidades where id=$1',[oportunidade])).rows[0].etapa,'APROVADA')
console.log('PASS: finalized direct quote, legacy quote, idempotency, token rotation, re-finalization, expiry, authorization, responded quote guards')
async function completar(token, cpf='12345678901') {
 return (await db.query("select completar_dados_cliente_proposta_v2_servidor($1,$2,'01001000','Rua Teste','10',null,'Centro','São Paulo','SP','teste@example.com') as resultado",[token,cpf])).rows[0].resultado
}
await db.query("insert into clientes(nome,cpf,email) values('Outro cliente','98765432109','outro@example.com')")
assert.equal((await completar(reaberto.public_token)).status,'DADOS_COMPLETOS')
assert.equal((await completar(reaberto.public_token)).ja_completo,true)
const cadastrado=(await db.query('select c.* from clientes c join orcamentos o on o.cliente_id=c.id where o.id=$1',[novo.id])).rows[0]
assert.equal(cadastrado.nome,'Cliente teste');assert.equal(cadastrado.email,'teste@example.com')
assert.equal((await db.query("select email from clientes where nome='Outro cliente'")).rows[0].email,'outro@example.com')
await assert.rejects(completar(rascunho.public_token),/aceita/)
const duplicado=await criar('ACEITA');await assert.rejects(completar(duplicado.public_token,'98765432109'),/unique constraint/);
const cnpj=await criar('ACEITA');assert.equal((await completar(cnpj.public_token,'12345678000199')).status,'DADOS_COMPLETOS')
console.log('PASS: direct post-acceptance registration, repeat safety, unrelated client preserved, CNPJ, acceptance guard')
await db.close()
