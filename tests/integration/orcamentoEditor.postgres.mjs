// Optional isolated SQL check; see docs/changes/editor_orcamentos_api.md.
import { fileURLToPath } from 'node:url'
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite')
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const root = fileURLToPath(new URL('../../', import.meta.url))
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role;
create table usuarios_empresa (empresa_id uuid, usuario_id uuid, ativo boolean, perfil text);
create table oportunidades (id uuid primary key, empresa_id uuid, cliente_id uuid);
create table kits (id uuid primary key, nome text, valor numeric);
create table estoque_itens (id uuid primary key, nome text, valor_reposicao numeric, valor_locacao numeric);
create table itens_conceituais (id uuid primary key, empresa_id uuid, nome text, preco_locacao_estimado numeric);
create table orcamentos (
 id uuid primary key default gen_random_uuid(), numero serial, empresa_id uuid, cliente_id uuid,
 oportunidade_id uuid, validade date, status text, origem text, contato_nome text, contato_telefone text,
 contato_email text, tema_evento text, data_evento date, horario_evento text, data_retirada date,
 horario_retirada time, data_devolucao date, endereco_evento text, observacoes text,
 desconto_tipo text default 'VALOR', desconto_valor numeric default 0, versao integer default 1,
 created_by uuid, subtotal numeric default 0, desconto numeric default 0, total_taxas numeric default 0,
 total numeric default 0, acrescimos numeric default 0, frete numeric default 0,
 resposta_cliente text, reserva_id uuid, updated_at timestamptz default now()
);
create table orcamento_itens (
 id uuid primary key default gen_random_uuid(), orcamento_id uuid, kit_id uuid, estoque_item_id uuid,
 item_conceitual_id uuid, tipo_origem text, descricao text, quantidade numeric, valor_unitario numeric,
 preco_base numeric, preco_unitario_orcamento numeric, desconto numeric, observacao text, ordem integer,
 subtotal_negociado numeric generated always as (greatest(quantidade * preco_unitario_orcamento - desconto, 0)) stored
);
create table orcamento_taxas (id uuid primary key default gen_random_uuid(), empresa_id uuid, orcamento_id uuid, descricao text, valor numeric, tipo text, observacao text, ordem integer, created_by uuid);
`)
const core = readFileSync(root + 'supabase/migrations/20261008173745_jornada_3_orcamento_core.sql', 'utf8')
const functions = core.slice(core.indexOf('create or replace function public.calcular_total_orcamento()'), core.indexOf('-- 5. RLS'))
await db.exec(functions + `
create trigger calcular_total before insert or update on orcamentos for each row execute function calcular_total_orcamento();
create trigger recalcular_itens after insert or update or delete on orcamento_itens for each row execute function recalcular_orcamento_por_itens();
`)
await db.exec(readFileSync(root + 'supabase/migrations/20261008183345_jornada_3_orcamento_persistencia_atomica.sql', 'utf8'))
await db.exec(readFileSync(root + 'supabase/migrations/20261008184708_jornada3_editor_visual.sql', 'utf8'))
const empresa = '11111111-1111-4111-8111-111111111111', usuario = '22222222-2222-4222-8222-222222222222', oportunidade = '33333333-3333-4333-8333-333333333333'
await db.query('insert into usuarios_empresa values ($1,$2,true,\'Comercial\')', [empresa,usuario])
await db.query('insert into oportunidades values ($1,$2,null)', [oportunidade,empresa])
const payload = {
 p_empresa_id: empresa, p_usuario_id: usuario, p_idempotencia: 'teste-editor',
 p_status: 'EM_EDICAO', p_origem: 'MANUAL', p_contato_nome: 'Cliente', p_contato_telefone: '11999999999',
 p_data_evento: '2027-01-12', p_desconto_tipo: 'PERCENTUAL', p_desconto_valor: 10,
 p_itens: [{ tipo_origem: 'LIVRE', descricao: 'Painel livre', quantidade: 2, preco_base: 120, preco_unitario_orcamento: 100.10, desconto: 10.20, ordem: 0 }],
 p_taxas: [{ descricao: 'Montagem', tipo: 'MONTAGEM', valor: 25.50, ordem: 0 }],
 oportunidade_id: oportunidade, validade: '2027-01-10'
}
async function salvar(dados) { return (await db.query('select salvar_orcamento_editor_jornada3_servidor($1::jsonb) as resultado', [JSON.stringify(dados)])).rows[0].resultado }
const criado = await salvar(payload)
assert.equal(criado.total, 196.5)
assert.equal(criado.versao, 1)
let registro = (await db.query('select * from orcamentos where id=$1', [criado.id])).rows[0]
assert.equal(registro.oportunidade_id, oportunidade)
assert.equal(registro.validade.toISOString().slice(0, 10), '2027-01-10')
assert.equal((await salvar(payload)).alterado, false)
assert.equal((await db.query('select count(*)::int as n from orcamentos')).rows[0].n, 1)
const editar = { ...payload, p_orcamento_id: criado.id, p_versao_esperada: 1, p_idempotencia: null }
const alterado = await salvar(editar)
assert.equal(alterado.versao, 2)
await assert.rejects(salvar(editar), /alterado por outra sessão/)
await assert.rejects(salvar({ ...editar, p_versao_esperada: 2, oportunidade_id: '44444444-4444-4444-8444-444444444444' }), /Solicitação não encontrada/)
assert.equal((await db.query('select versao from orcamentos where id=$1',[criado.id])).rows[0].versao, 2)
await db.query('update orcamentos set acrescimos=20, frete=30 where id=$1',[criado.id])
const migrado = await salvar({ ...editar, p_versao_esperada: 2, p_taxas: [...payload.p_taxas, { descricao: 'Acréscimos', tipo: 'EXTRA', valor: 20 }, { descricao: 'Frete', tipo: 'ENTREGA', valor: 30 }] })
assert.equal(migrado.total, 246.5)
assert.equal(migrado.total_taxas, 75.5)
registro = (await db.query('select * from orcamentos where id=$1', [criado.id])).rows[0]
assert.equal(Number(registro.frete), 0)
assert.equal(Number(registro.acrescimos), 0)
await db.query("update orcamentos set status='ACEITA' where id=$1", [criado.id])
await assert.rejects(salvar({ ...editar, p_versao_esperada: 3 }), /não está disponível/)
await db.query('insert into estoque_itens values ($1,$2,900,120)', ['55555555-5555-4555-8555-555555555555','Peça física'])
await db.query('insert into itens_conceituais values ($1,$2,$3,200)', ['66666666-6666-4666-8666-666666666666',empresa,'Conceito'])
const catalogo = await salvar({ ...payload, p_idempotencia: 'teste-catalogo', p_itens: [
 { tipo_origem: 'ESTOQUE', estoque_item_id: '55555555-5555-4555-8555-555555555555', descricao: 'Peça com descrição negociada', quantidade: 1, preco_unitario_orcamento: 100, desconto: 0, ordem: 0 },
 { tipo_origem: 'CONCEITUAL', item_conceitual_id: '66666666-6666-4666-8666-666666666666', descricao: 'Conceito personalizado', quantidade: 1, preco_unitario_orcamento: 150, desconto: 0, ordem: 1 }
] })
assert.equal(catalogo.possui_item_conceitual, true)
const linhas = (await db.query('select * from orcamento_itens where orcamento_id=$1 order by ordem', [catalogo.id])).rows
assert.equal(Number(linhas[0].preco_base), 120)
assert.equal(Number(linhas[0].preco_unitario_orcamento), 100)
assert.equal(linhas[0].descricao, 'Peça com descrição negociada')
assert.equal(linhas[1].descricao, 'Conceito personalizado')
assert.equal((await db.query('select nome from estoque_itens')).rows[0].nome, 'Peça física')
console.log('PASS: real SQL migration, create/edit, totals, metadata, idempotency, conflict, rollback, legacy fees, closed quote guard')
await db.close()
