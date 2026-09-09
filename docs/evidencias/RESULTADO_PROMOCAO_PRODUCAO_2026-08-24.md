# Resultado da promoção de produção — 24/08/2026

## Resultado

Promoção concluída com sucesso em 24/08/2026. O banco e o frontend de produção
foram atualizados na mesma janela, sem erro de migração, build ou runtime.

## Banco Supabase

- Projeto: `pxhgfyvpzbcjymmnoyuo`.
- Migração registrada: `promover_esteira_comercial_consolidada_20260824`.
- Pré-checagem: 1 conexão ativa e nenhuma transação com mais de 5 minutos.
- Registros normalizados: 1 oportunidade e 2 propostas.
- Estados legados após a migração: zero.
- Estados finais: oportunidade `CONVERTIDA_EM_PROPOSTA`; propostas
  `ACEITA/RESERVA_CONFIRMADA` e `RASCUNHO`.
- Defaults confirmados: oportunidade `RECEBIDA`; proposta `RASCUNHO`.
- Índices `oportunidades_empresa_etapa_recebida_idx` e
  `orcamentos_empresa_status_formalizacao_idx` confirmados.
- Advisors de segurança: 10 avisos conhecidos após a promoção, correspondentes
  a 9 RPCs/helpers autenticados intencionais e à proteção contra senhas vazadas
  ainda não habilitada no Auth.

## Frontend Vercel

- Projeto: `crm-cintia-paula-v3-supabase`.
- Commit publicado: `decf6164e73f435d7a20d827304b025e0b1ca5bd`.
- Deployment: `dpl_5apkqYfaXEG91RVy2bMYexTKVhK3`.
- Estado: `READY`.
- Target: `production`.
- Build remoto: Next.js 16.2.12, compilação e TypeScript aprovados.
- Domínios confirmados: raiz, `www` e aliases Vercel de produção.
- Deployment anterior preservado para rollback:
  `dpl_94K32ormXYhppUfUKZ8YK44CbZ9p`.

## Smoke test

- Site público respondeu e encaminhou corretamente para o login do ERP.
- Login renderizou e não apresentou erro de console.
- Proposta real `ORC-0007` abriu no domínio público com itens, totais, estado de
  aceite e formulário de dados do contrato.
- Nenhum formulário foi submetido e nenhum dado adicional foi alterado.
- Varredura Vercel após o corte: nenhum erro de runtime nos 15 minutos
  consultados.

## Pendências não bloqueantes

- Habilitar a proteção contra senhas vazadas no Supabase Auth.
- Tratar Advisors de performance em rodada separada, com medição de consultas e
  revisão dos índices duplicados/políticas permissivas.
- Executar, com credencial operacional, o teste autenticado completo do ERP em
  uma sessão acompanhada, sem compartilhar senha.
