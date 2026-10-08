# Editor de orçamentos conectado à API 3.0

O editor de `/orcamentos` usa `POST /api/orcamentos` e `PUT /api/orcamentos/:id`, com token de sessão, chave de idempotência na criação e versão na edição. Cabeçalho, itens e taxas são salvos na mesma transação. Não há mais exclusão/inserção de itens diretamente pelo navegador.

Inclui kits, peças físicas, itens livres e seleção de conceitos já cadastrados; preços negociados; desconto por linha em reais; desconto global em reais ou percentual; taxas com tipo, descrição, valor e observação. O cálculo usa a mesma função de domínio da aplicação. Valores vazios, negativos e descontos acima do subtotal são rejeitados. A reabertura busca cabeçalho, versão, itens e taxas juntos.

## Banco e implantação

Aplicar `supabase/migrations/20261008184708_jornada3_editor_visual.sql` depois das migrations de core e persistência atômica da Jornada 3.0, antes de publicar o frontend/backend. A migração cria um adaptador server-only que preserva solicitação/validade, descrições negociadas e preço-base de locação. Frete e acréscimos antigos viram taxas ao editar e são zerados no cabeçalho na mesma transação, evitando duplicação. A RPC anterior permanece disponível para os demais consumidores.

A migração foi validada em PostgreSQL temporário (PGlite), com tabelas de teste e as funções SQL reais de cálculo/persistência. Ela não foi aplicada ao banco do projeto nesta etapa. Nenhuma mensagem foi enviada nem houve publicação.

## Finalização

“Salvar rascunho” grava `EM_EDICAO`; “Finalizar orçamento” grava `FINALIZADO`. Para registros `NOVO` ou `FINALIZADO`, a edição passa por `EM_EDICAO` antes de finalizar. Conflitos de versão preservam o formulário e exigem reabrir os dados atuais. Repetição de criação recupera o registro sem duplicar e mantém o formulário para revisão.

O envio por e-mail antigo continua disponível somente para os status legados aceitos pelo seu endpoint. O botão de finalização não promete nem dispara envio: a extensão de envio/aceite para os novos status é uma etapa separada. A seleção de itens conceituais depende de conceitos existentes; este editor não cria o cadastro de conceitos.

## Verificação

- `npm test`: 40 testes, incluindo serialização editor → parser → aplicação e cálculo financeiro.
- `npm run typecheck` e `npm run build` aprovados.
- Teste SQL isolado: criação/edição, totais, validade e solicitação, idempotência, conflito, rollback, conversão de taxas legadas, proteção de orçamento encerrado, descrição negociada e itens conceituais.
- Não foi feita uma sessão autenticada de teste no navegador contra o banco real.

Para repetir o teste SQL sem instalar dependências no projeto:

```sh
npm install --prefix /tmp/orcamento-editor-dbcheck --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.3.14
PGLITE_MODULE=/tmp/orcamento-editor-dbcheck/node_modules/@electric-sql/pglite/dist/index.js node tests/integration/orcamentoEditor.postgres.mjs
```
