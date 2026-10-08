# Jornada Simplificada 3.0 — Sprint 2

Data: 08/10/2026  
Ambiente validado: Supabase homologação `iwcdrexhwiuycfdbitnw`  
Produção: não alterada

## Entrega

- persistência atômica de cabeçalho, itens e taxas do Orçamento 3.0;
- chave de idempotência por empresa para impedir criação duplicada;
- concorrência otimista por `versao` para impedir sobrescrita silenciosa;
- validação server-side das transições `NOVO`, `EM_EDICAO`, `FINALIZADO` e
  `CANCELADO`;
- preços-base de kit, estoque e item conceitual obtidos no banco;
- item conceitual permanece sem qualquer efeito no saldo do estoque;
- RPC restrita a `service_role`, invocada somente por API server-side;
- autoria propagada à auditoria somente após validar o vínculo ativo do usuário;
- eventos do Event Bus publicados após a persistência, sem duplicação em retry;
- rotas `POST /api/orcamentos` e `PUT/PATCH /api/orcamentos/[id]`.

## Verificações executadas

- `git diff --check`: aprovado;
- `npm run typecheck`: aprovado;
- `npm test`: 36 testes aprovados;
- `npm run build`: aprovado com Next.js 16.2.12;
- teste SQL transacional com `ROLLBACK`: aprovado antes e depois da migration;
- cenários SQL: criação, totalização, retry idempotente, atualização completa,
  desconto percentual, taxa, versão obsoleta e privilégios da RPC;
- migration remota: `20261008183345_jornada_3_orcamento_persistencia_atomica`.

## Segurança

A função `salvar_orcamento_jornada3_servidor` usa `SECURITY DEFINER` com
`search_path` vazio, valida empresa/usuário/perfil ativo e concede execução
exclusivamente a `service_role`. O cliente web não recebe a chave administrativa.

Os advisors do Supabase não apontaram a nova função como executável por
`authenticated`. Permanecem alertas preexistentes em funções e políticas legadas;
eles devem seguir na trilha contínua de hardening, fora do escopo desta migration.
