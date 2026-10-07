# Mapa de ambientes e fluxo de release

## Ambientes

| Finalidade | Vercel | Supabase | Branch/commit esperado |
|---|---|---|---|
| Desenvolvimento local | checkout local | Homologação | branch de trabalho validada |
| Homologação | `crm-cintia-paula-homologacao` | `iwcdrexhwiuycfdbitnw` | commit candidato exato |
| Produção | `crm-cintia-paula-v3-supabase` | `pxhgfyvpzbcjymmnoyuo` | somente commit promovido e aprovado |

O arquivo `.vercel/project.json` deste checkout aponta exclusivamente para o
projeto de homologação. Nenhum comando `vercel --prod` deverá ser executado em
outro projeto a partir deste vínculo.

## Variáveis exigidas, sem valores

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — somente servidor

### Segurança da jornada pública

- `SITE_EMPRESA_ID`
- `SITE_ALLOWED_ORIGINS`
- `PRE_RESERVA_RATE_LIMIT_SECRET`
- `ACOMPANHAMENTO_ENCRYPTION_KEY`
- `CONTRATO_AUDIT_SALT`

### Comunicação

- `RESEND_API_KEY`
- `EMAIL_REMETENTE`
- `EMAIL_RESPOSTA`

### Pagamentos

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_WEBHOOK_SECRET`

As variáveis públicas podem conter somente URL e chave publicável/anon do
Supabase. Service role, secrets de rate limit, criptografia, e-mail e pagamentos
nunca podem usar prefixo `NEXT_PUBLIC_`.

## Fluxo único

1. desenvolver apenas na branch autorizada;
2. executar testes, TypeScript e build local;
3. criar commit candidato e enviar a branch remota;
4. aguardar deployment `READY` no projeto de homologação;
5. confirmar que o deployment informa exatamente o SHA candidato;
6. executar smoke tests e invariantes no Supabase de homologação;
7. registrar resultado, advisors e rollback;
8. promover banco e aplicação de produção somente após aceite explícito.

## Bloqueios

- um deployment `READY` em SHA diferente não vale como homologação;
- preview do projeto de produção não substitui o projeto de homologação;
- nenhuma credencial de produção será copiada para homologação;
- migrations e frontend devem fazer parte da mesma unidade de release;
- produção não será reconstruída a partir de uma branch não homologada.

Referência: https://vercel.com/docs/deployments
