# Ensaio de restauração — 24/08/2026

## Ambiente

- Origem: produção `pxhgfyvpzbcjymmnoyuo` (somente leitura).
- Destino isolado temporário: `vpsbdpqrlmxhpoeshrqq`.
- PostgreSQL de origem e destino: 17.6.
- Cliente: PostgreSQL 17.11, Postgres.app 2.9.6.
- Produção não foi alterada.

## Achado no backup original

O primeiro restore, executado com `--single-transaction` e
`ON_ERROR_STOP=1`, abortou em `role "anon" already exists`. O conjunto original
foi produzido por `pg_dump/pg_dumpall` bruto e incluía papéis e schemas
gerenciados que já existem em um projeto Supabase novo. O rollback foi
confirmado: o schema `public` do destino permaneceu vazio.

O dump de schema também não continha as ACLs efetivas dos objetos. Sem a
reposição dessas permissões, funções servidoras `SECURITY DEFINER` seriam
expostas novamente a `anon/authenticated` no banco restaurado.

## Conjunto de recuperação corrigido

Criado em
`/Users/macbookair/Documents/CP Festas/backups/crm-cintia-paula/2026-08-24/restauracao-supabase`:

- `roles-app.sql`: preserva os papéis gerenciados do destino.
- `schema-app.sql`: somente schemas/objetos próprios (`public` e `private`).
- `data-app-auth.sql`: dados próprios e Auth, sem duplicar migrações internas.
- `acls-app.sql`: ACLs efetivas exportadas do catálogo de produção.

Ordem validada: roles → schema → dados com
`session_replication_role = replica` dentro da transação → ACLs → pacote de
promoção → consultas de validação.

## Integridade

As contagens do destino foram idênticas às de produção:

| Entidade | Produção | Restaurado |
| --- | ---: | ---: |
| `auth.users` | 2 | 2 |
| clientes | 12 | 12 |
| kits | 30 | 30 |
| itens de estoque | 68 | 68 |
| reservas | 8 | 8 |
| orçamentos | 2 | 2 |
| contratos | 4 | 4 |
| auditoria | 769 | 769 |
| timeline de reservas | 509 | 509 |

Não foram encontrados órfãos entre reserva/orçamento nem entre
`usuarios_empresa`/`auth.users`.

## Promoção e segurança

O pacote `001_esteira_comercial_consolidada.sql` foi aplicado e reaplicado sem
erro. A segunda execução não alterou dados, confirmando idempotência operacional.

- Estados finais: oportunidade `CONVERTIDA_EM_PROPOSTA`; propostas
  `ACEITA/RESERVA_CONFIRMADA` e `RASCUNHO`.
- Índices da nova esteira presentes.
- `executar_formalizacao_servidor`: negada a `anon/authenticated` e permitida a
  `service_role`.
- `auditar_empresa`: negada a `anon/authenticated`.
- `meu_acesso`: preservada para `authenticated`.
- Advisors: 45 `WARN` de segurança em produção antes da promoção; 10 no
  ambiente restaurado/promovido. Os nove avisos de funções restantes são RPCs
  autenticadas/helpers de RLS intencionais; o décimo é a proteção contra senhas
  vazadas, configurável no Auth.

## Observações

- O backup lógico não contém os binários do Storage.
- Configurações de Auth, SMTP, chaves, URLs e Edge Functions não são restauradas
  pelos SQLs e devem ser tratadas separadamente em recuperação real.
- O projeto temporário deve ser excluído após a aprovação do resultado e a
  homologação original deve ser reativada.
