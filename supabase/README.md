Execute os arquivos da pasta migrations no Supabase SQL Editor, em ordem numérica.

Migração inicial:
- migrations/20260627_001_base.sql

Consolidação V3 → V6:
- `migrations/20260723_018_consolidacao_v3_v6.sql` preserva o estoque legado,
  centraliza composição e movimentações em `estoque_itens`/`kit_composicao`,
  normaliza os status da reserva e ativa retirada/devolução auditáveis.
- A migração é idempotente: os vínculos já migrados ficam registrados em
  `consolidacao_estoque_v3_v6` para evitar cópias duplicadas.
