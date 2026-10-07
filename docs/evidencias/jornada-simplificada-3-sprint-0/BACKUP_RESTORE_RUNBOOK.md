# Runbook de backup e restauração

## Pré-requisitos

- acesso ao dashboard do Supabase;
- senha de conexão do banco de produção disponível sem ser registrada no Git;
- Supabase CLI e Docker, ou cliente PostgreSQL 17 compatível;
- diretório local fora do repositório, com permissão `0700`;
- espaço suficiente para banco e aproximadamente 19 MB atuais de Storage.

## Dump recomendado pelo Supabase

Usar uma variável local de sessão para a URL de conexão. Nunca gravar a URL com senha em arquivo versionado ou histórico de shell.

```sh
supabase db dump --db-url "$JORNADA3_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$JORNADA3_DB_URL" -f schema.sql
supabase db dump --db-url "$JORNADA3_DB_URL" -f data.sql --use-copy --data-only
```

Gerar checksums:

```sh
shasum -a 256 roles.sql schema.sql data.sql
```

## Storage

O backup do banco não contém o conteúdo dos objetos do Storage. A metadata fica no banco, mas os arquivos precisam de cópia independente.

```sh
node scripts/preservacao/export-public-storage.mjs \
  storage-manifest.json \
  https://pxhgfyvpzbcjymmnoyuo.supabase.co \
  storage
```

O script recusa caminhos inseguros, valida tamanho e grava SHA-256 de cada arquivo. Se algum bucket privado passar a conter objetos, deverá ser criado um exportador autenticado; não tornar o bucket público para facilitar o backup.

## Ensaio de restauração

Restaurar em um projeto ou Postgres isolado, nunca sobre produção:

```sh
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "$JORNADA3_RESTORE_DB_URL"
```

Após restaurar:

1. executar `001_baseline_readonly.sql`;
2. comparar contagens e assinatura do schema;
3. validar Auth, RLS, funções e triggers;
4. conferir os 112 objetos e seus checksums;
5. registrar o resultado sem incluir dados pessoais ou segredos.

## Estado atual

O dump lógico, a cópia do Storage e o ensaio de restauração foram concluídos em 07/10/2026. O dump completo foi preservado; o ensaio local validou os schemas `public`, `private`, `auth` e `storage`, porque extensões gerenciadas como `supabase_vault` não existem em um PostgreSQL comum.

Esse limite é esperado e está documentado. Para recuperação real da plataforma completa, restaurar em um projeto Supabase compatível; para validar os dados da aplicação, utilizar `scripts/preservacao/rehearse-restore.mjs`.

Documentação oficial: https://supabase.com/docs/guides/platform/backups
