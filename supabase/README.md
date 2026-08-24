Use o Supabase CLI como caminho oficial e aplique os arquivos da pasta `migrations`
em ordem cronológica. O SQL Editor deve ser apenas uma alternativa operacional
controlada, nunca um fluxo paralelo sem registro no Git.

> Não aplique as migrações deste diretório em produção enquanto o histórico
> remoto não estiver reconciliado e o backup/rollback não estiver preparado.
> A sequência completa já foi validada no projeto isolado de homologação.

Migração inicial:
- migrations/20260627_001_base.sql

Consolidação V3 → V6:
- `migrations/20260723_018_consolidacao_v3_v6.sql` preserva o estoque legado,
  centraliza composição e movimentações em `estoque_itens`/`kit_composicao`,
  normaliza os status da reserva e ativa retirada/devolução auditáveis.
- A migração é idempotente: os vínculos já migrados ficam registrados em
  `consolidacao_estoque_v3_v6` para evitar cópias duplicadas.

Consolidação da esteira comercial:
- `20260824174140_consolidar_esteira_comercial_unica.sql` converte os estados
  legados das oportunidades para a jornada oficial e impede novas gravações
  com esses nomes antigos.
- A migração preserva IDs, relacionamentos e histórico; não exclui registros.
- As RPCs financeiras históricas permanecem encapsuladas pelo servidor; a
  migração seguinte garante que seus estados temporários não sejam persistidos.
- Faça backup e valide as contagens por estado antes de aplicá-la em produção.

Normalização de propostas e formalização:
- `20260824180053_normalizar_propostas_e_formalizacao.sql` converte propostas e
  formalizações persistidas para os estados oficiais.
- Reservas vinculadas permanecem pendentes até contrato e sinal estarem
  concluídos; somente então são confirmadas e passam a bloquear o estoque.
- Estorno ou chargeback devolve a reserva confirmada para formalização.
