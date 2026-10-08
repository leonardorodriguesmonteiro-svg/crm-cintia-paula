# Editor de orçamentos conectado à API 3.0

O editor de `/orcamentos` usa `POST /api/orcamentos` e `PUT /api/orcamentos/:id`, com token de sessão, chave de idempotência na criação e versão na edição. Cabeçalho, itens e taxas são salvos na mesma transação. Não há mais exclusão/inserção de itens diretamente pelo navegador.

Inclui kits, peças físicas, itens livres e seleção de conceitos já cadastrados; preços negociados; desconto por linha em reais; desconto global em reais ou percentual; taxas com tipo, descrição, valor e observação. O cálculo usa a mesma função de domínio da aplicação. Valores vazios, negativos e descontos acima do subtotal são rejeitados. A reabertura busca cabeçalho, versão, itens e taxas juntos.

## Banco e implantação

Aplicar `supabase/migrations/20261008184708_jornada3_editor_visual.sql` depois das migrations de core e persistência atômica da Jornada 3.0, antes de publicar o frontend/backend. A migração cria um adaptador server-only que preserva solicitação/validade, descrições negociadas e preço-base de locação. Frete e acréscimos antigos viram taxas ao editar e são zerados no cabeçalho na mesma transação, evitando duplicação. A RPC anterior permanece disponível para os demais consumidores.

A migração foi validada em PostgreSQL temporário (PGlite), com tabelas de teste e as funções SQL reais de cálculo/persistência. Após autorização, foi aplicada em homologação e produção em 08/10/2026, e a aplicação foi publicada. Nenhuma mensagem foi enviada a clientes.

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

## Publicação — 08/10/2026

- Código: `2be7e52548f6e21980b80e1f70bfe867027e9e61`.
- Homologação: `dpl_AVsjErfYxpFPiS5egesW7SG1kwbE`, READY.
- Produção: `dpl_5VLbBmj9bjQGxCW7EDFJC8E8Jmtd`, READY e promovido.
- URL: https://erp.cintiapaulafestaedecoracao.com.br/orcamentos
- Rollback da aplicação: deployment anterior `dpl_HUAZmpnVX3DpaZgAvBXzMN4wGu6R`. As migrations preservam colunas/status legados; eventual rollback não deve excluir tabelas novas nem os novos orçamentos.

Migrations remotas de produção (nomes correspondem aos arquivos locais; timestamps foram gerados pelo Supabase):

| Versão remota | Nome |
|---|---|
| 20261008190316 | jornada_3_orcamento_core |
| 20261008190327 | jornada_3_orcamento_core_indexes |
| 20261008190332 | jornada_3_orcamento_persistencia_atomica |
| 20261008190340 | jornada3_editor_visual |

Verificações pós-migração:

- Smoke SQL transacional em ambos os ambientes: criar, calcular, repetir sem duplicar, finalizar, rejeitar versão antiga e ROLLBACK.
- Invariantes de produção antes/depois: 4 orçamentos, 14 itens, total R$ 1.100,90, 9 reservas, 63 itens de estoque.
- As duas RPCs de salvamento concedem EXECUTE somente a service_role.
- Página oficial HTTP 200 e API HTTP 401 sem sessão; os 11 bundles do domínio oficial coincidem com o deployment validado.
- Navegador sem sessão foi encaminhado ao login. A operação autenticada completa no navegador ainda não foi exercitada.
- Consulta de logs do novo deployment: nenhum registro error/fatal encontrado na janela de 15 minutos após a publicação.
- Advisors: avisos legados em funções SECURITY DEFINER e proteção de senhas; as RPCs novas não foram apontadas. Não houve mudança nesses controles.

A revisão automática rejeitou uma tentativa de exportar um backup adicional de dados para um arquivo local por falta de autorização específica para esse destino. Nenhum dado foi exportado, e o arquivo temporário com a mensagem de rejeição foi removido. O backup completo e o ensaio de restauração de 07/10 permanecem como referência; a migration principal também verificou as invariantes dentro da própria transação.
