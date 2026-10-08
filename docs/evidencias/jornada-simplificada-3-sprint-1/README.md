# Sprint 1 — Núcleo do Orçamento 3.0

**Data:** 08/10/2026  
**Branch:** `feat/esteira-comercial-v2-integrada`  
**Ambiente aplicado:** Supabase de homologação `iwcdrexhwiuycfdbitnw`  
**Produção:** não alterada

## Entrega

- evolução aditiva de `orcamentos` com origem, contato preliminar, desconto
  normalizado e total de taxas;
- evolução aditiva de `orcamento_itens` com origem estruturada, preço-base,
  preço negociado, desconto por item e subtotal negociado;
- criação de `orcamento_taxas`;
- criação de `itens_conceituais` sem qualquer coluna de saldo disponível;
- compatibilidade bidirecional temporária entre `valor_unitario` legado e
  `preco_unitario_orcamento`;
- RLS por empresa e perfil Comercial/Administrador;
- auditoria nas duas novas tabelas;
- eventos de domínio para criar, editar, finalizar e cancelar orçamento;
- cálculo de domínio em centavos para evitar erros de ponto flutuante.

## Migrations homologadas

1. `20261008173745_jornada_3_orcamento_core.sql`
2. `20261008173839_jornada_3_orcamento_core_indexes.sql`

Os nomes locais foram alinhados às versões registradas no histórico remoto.

## Verificações

- ensaio completo da migration com `ROLLBACK` antes da aplicação;
- teste SQL transacional executado depois da aplicação e revertido;
- `npm test`: 32 testes aprovados;
- `npm run typecheck`: aprovado;
- `npm run build`: aprovado com Next.js 16.2.12;
- RLS ativa em `itens_conceituais` e `orcamento_taxas`;
- uma policy empresarial em cada tabela nova;
- nenhum item ou taxa de teste persistiu;
- contagens preservadas na homologação: 1 orçamento, 1 item de orçamento e
  1 item de estoque;
- nenhuma divergência entre preço legado e preço negociado após o backfill;
- nenhuma divergência entre subtotal legado e subtotal negociado;
- `itens_conceituais` não possui `quantidade_total` nem
  `quantidade_disponivel`.

## Advisors

As três novas chaves estrangeiras inicialmente apontadas sem índice foram
corrigidas na segunda migration. A contagem de `unindexed_foreign_keys` voltou
ao baseline anterior, sem ocorrência referente às estruturas da Jornada 3.

Nenhuma função nova da Jornada 3 foi apontada como `SECURITY DEFINER`
executável por usuários autenticados. Permanecem os achados históricos já
inventariados na Sprint 0:

- [RLS habilitada sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy);
- [funções SECURITY DEFINER executáveis](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable);
- [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Próximo corte

Criar a Application Layer e a persistência atômica do agregado de orçamento.
A interface React atual ainda não utiliza diretamente as novas estruturas.
