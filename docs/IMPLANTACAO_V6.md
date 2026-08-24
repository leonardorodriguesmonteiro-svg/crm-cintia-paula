# Implantação V6

## Fonte oficial

- Repositório: `leonardorodriguesmonteiro-svg/crm-cintia-paula`.
- A V6 é a única base ativa. Pastas V1-V5 e cópias da V3 são somente históricas.
- Homologue a branch de trabalho antes de integrá-la à `main`.

## Banco de dados

> **Produção protegida (24/08/2026):** a jornada foi validada no projeto
> isolado de homologação. Não execute `supabase db push` em produção antes do
> backup, da reconciliação do histórico remoto e da revisão do plano de rollback
> descritos em `docs/HOMOLOGACAO_SUPABASE_2026-08-24.md`.

1. Configure e autentique o Supabase CLI para o projeto correto.
2. Confira o histórico com `supabase migration list`.
3. Reconcilie as versões já executadas remotamente e só então aplique as novas
   migrações, em ordem, com `supabase db push`.
4. Não execute somente a migração inicial: a aplicação depende da sequência completa em `supabase/migrations`.
5. Antes de produção, execute os advisors de segurança e desempenho do Supabase.

## Aplicação

1. Copie `.env.example` para `.env.local` e preencha as variáveis.
2. Rode `npm ci`.
3. Valide com `npm run typecheck`, `npm test` e `npm run build`.
4. Vincule ao projeto existente da Vercel e publique somente após a homologação da jornada completa.

## Homologação mínima

Site/ERP → pré-reserva → análise → proposta → aceite → dados do cliente → contrato → pagamento → reserva confirmada.
