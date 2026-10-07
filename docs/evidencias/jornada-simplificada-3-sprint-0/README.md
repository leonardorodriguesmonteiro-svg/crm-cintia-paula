# Sprint 0 — Preservação e baseline canônico

Data de captura: 07/10/2026.

Esta pasta contém somente evidências e ferramentas de preservação. Nenhuma migration da Jornada 3.0 foi aplicada.

## Evidências concluídas

- baseline de contagens e assinatura de schema em produção e homologação;
- snapshots TypeScript dos dois schemas;
- inventário de buckets e objetos;
- inventário das migrations remotas;
- checksum combinado das 64 migrations locais;
- mapa dos deployments de produção e homologação;
- verificação dos advisors de segurança;
- build, typecheck e testes da branch auditada.

## Situação de backup

O dashboard confirmou que o projeto de produção está no plano Free e não possui backups agendados. O backup lógico manual foi concluído antes da primeira migration.

Foi utilizado o cliente PostgreSQL 17.11 oficial do Postgres.app, com aplicativo notarizado. A senha do banco foi rotacionada com autorização do usuário e armazenada somente no Chaves do macOS. Nenhuma senha foi gravada no Git.

O Storage é separado do backup do banco. Os 112 objetos de produção foram copiados e verificados pelo script `scripts/preservacao/export-public-storage.mjs`. Os buckets privados estavam vazios na captura.

Artefato local, deliberadamente fora do Git:

- `/Users/macbookair/Documents/CP Festas/backups/crm-cintia-paula/20261007T171956Z/production/storage.tar.gz`
- 112 objetos, 18.537.635 bytes, nenhuma ausência;
- SHA-256 do pacote: `c266abe20f4008658642c9148a9428ff055c1135c8753fab926933671e596703`.

Pacote mestre de preservação:

- `/Users/macbookair/Documents/CP Festas/backups/crm-cintia-paula/20261007T171956Z/production-preservation.tar.gz`
- 19.078.184 bytes;
- SHA-256: `319fb3db4488193f623a730fb02a51d099b331bcc14051b37d102820d0ca7e42`.

O ensaio de restauração dos schemas `public`, `private`, `auth` e `storage` foi aprovado em PostgreSQL 17 local e descartável. Todas as contagens principais coincidiram com produção.

## Regra de avanço

Não aplicar migrations até que existam simultaneamente:

1. dump lógico de roles, schema e dados — concluído;
2. cópia verificada dos objetos do Storage — concluída;
3. ensaio de restauração em ambiente isolado — concluído;
4. consultas de invariantes aprovadas;
5. homologação executando exatamente o commit candidato.

## Arquivos

- `001_baseline_readonly.sql`: inventário reproduzível e somente leitura;
- `database.types.production.ts`: snapshot do schema de produção;
- `database.types.homologation.ts`: snapshot do schema de homologação;
- `BASELINE_2026-10-07.md`: resultados e divergências observadas;
- `MIGRATION_RECONCILIATION.md`: estratégia para reconciliar o histórico;
- `BACKUP_RESTORE_RUNBOOK.md`: procedimento seguro de dump, restore e verificação;
- `MIGRATIONS_LOCAL_SHA256.md`: checksum individual das migrations locais;
- `migrations.*.json`: histórico remoto dos dois ambientes;
- `advisors.security.*.json`: snapshot dos advisors de segurança.
- `RESTORE_REHEARSAL_2026-10-07.md`: resultado do ensaio de restauração.
