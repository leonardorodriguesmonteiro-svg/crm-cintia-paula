# Ensaio de restauração — 07/10/2026

## Resultado

**Aprovado.**

O dump completo de produção foi restaurado em um PostgreSQL 17.11 temporário, local e descartável. O ensaio validou os schemas da aplicação `public`, `private`, `auth` e `storage`.

Extensões exclusivas da plataforma gerenciada, como `supabase_vault`, foram preservadas no dump completo, mas excluídas do ensaio local porque não existem no Postgres.app. Nenhuma alteração foi feita no arquivo de backup original.

## Contagens restauradas

| Entidade | Produção | Restaurado | Resultado |
|---|---:|---:|---|
| Clientes | 15 | 15 | OK |
| Kits | 53 | 53 | OK |
| Itens de estoque | 63 | 63 | OK |
| Reservas | 9 | 9 | OK |
| Contratos | 4 | 4 | OK |
| Orçamentos | 4 | 4 | OK |
| Itens de orçamento | 14 | 14 | OK |
| Oportunidades | 6 | 6 | OK |
| Itens de oportunidade | 12 | 12 | OK |
| Logs de auditoria | 1.189 | 1.189 | OK |
| Usuários Auth | 2 | 2 | OK |
| Registros do Storage | 112 | 112 | OK |

## Arquivos do banco

- `database.custom`: 952.248 bytes — SHA-256 `2b62256c27a31a4fe84167cf47733d0ea79fb2ac847bbb4bcda7b2778a4ffc98`
- `schema.sql`: 512.640 bytes — SHA-256 `0660388eb5b2308b65e98274de1dc1dce70259f8e04b7ec03131de7d197658ad`
- `roles.sql`: 5.370 bytes — SHA-256 `715a3f3b331fc35e4b8ed2448dbd07606a8895758f8e8d9c2c7ddd827de0bfcd`
- `database.archive-list.txt`: 83.145 bytes — SHA-256 `a4afb7ac29cfea461ca8a59a3a224801f401bced58d28e153b6908b0985c2b6a`

## Ferramentas

- origem: Postgres.app 2.9.6 oficial;
- `pg_dump`, `pg_restore` e `psql`: PostgreSQL 17.11;
- aplicativo aceito pelo Gatekeeper como `Notarized Developer ID`;
- origem da conexão: Supabase Session Pooler IPv4 com SSL obrigatório;
- senha: Chaves do macOS, nunca versionada.

## Conclusão

Os pré-requisitos de preservação da Sprint 0 estão satisfeitos. A reconciliação das migrations e a preparação da homologação podem avançar sem executar SQL destrutivo em produção.
