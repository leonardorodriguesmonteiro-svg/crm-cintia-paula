# Pré-flight de produção — 24/08/2026

## Decisão

O pacote está tecnicamente apto para promoção, mas a alteração do banco e a
troca do aplicativo devem ocorrer na mesma janela. Até a confirmação final da
janela, nenhuma escrita será feita em produção.

## Código e artefato

- Branch: `feat/esteira-comercial-v2-integrada`.
- Código validado: `2900bbe` (inclui a consolidação iniciada em `8de10ff`).
- `npm run build`: aprovado com Next.js 16.2.12 e TypeScript.
- Pacote SQL: `promocao-producao-2026-08-24/001_esteira_comercial_consolidada.sql`.
- Validação SQL: `promocao-producao-2026-08-24/002_validacao_pos_promocao.sql`.
- O pacote foi aplicado duas vezes no restore isolado, sem erro e sem alteração
  adicional de dados na segunda execução.

O deploy atualmente publicado em produção informa o commit `f4c008ca`, que não
existe no histórico Git local disponível. Portanto, ele não deve ser usado como
base de comparação nem como novo artefato. O rollback do frontend continuará
sendo o deployment Vercel atualmente publicado, `dpl_94K32ormXYhppUfUKZ8YK44CbZ9p`.

## Estado do banco de produção

Leitura executada em `2026-08-24T23:05:54Z`:

| Verificação | Resultado |
| --- | ---: |
| Usuários Auth | 2 |
| Reservas | 8 |
| Orçamentos | 2 |
| Oportunidades | 1 |
| Orçamentos em estados legados | 2 |
| Oportunidades em estados legados | 1 |
| Conexões ativas | 5 |
| Transações longas | 0 |

A função `executar_formalizacao_servidor` ainda contém a assinatura anterior,
confirmando que o pacote não foi aplicado acidentalmente em produção.

## Advisors antes da promoção

- Segurança: 45 avisos (`WARN`).
- Performance: 25 avisos (`WARN`).
- No restore promovido, os avisos de segurança caíram de 45 para 10.
- Os avisos restantes são nove RPCs/helpers autenticados intencionais e a
  configuração de proteção contra senhas vazadas do Auth.

Os avisos de performance existentes não bloqueiam esta promoção: o volume
atual é pequeno e o pacote já adiciona os índices específicos da nova esteira.
Eles devem ser tratados em uma rodada posterior, com medição, para evitar
criação ou remoção indiscriminada de índices.

## Ordem da janela

1. Pausar novas alterações administrativas por alguns minutos.
2. Confirmar ausência de transações longas e repetir as contagens acima.
3. Deixar um deployment Vercel da versão validada em estado `READY`, ainda sem
   apontar os domínios públicos.
4. Aplicar `001_esteira_comercial_consolidada.sql` como migração versionada.
5. Executar `002_validacao_pos_promocao.sql`; interromper se alguma asserção
   falhar.
6. Promover o deployment Vercel preparado para produção.
7. Testar login do ERP, oportunidade, proposta pública, aceite e formalização.
8. Verificar erros de runtime e Advisors; encerrar a pausa administrativa.

## Contingência

- Antes da promoção do frontend: não promover se a validação SQL falhar.
- Depois da promoção: reatribuir imediatamente os domínios ao deployment
  anterior se houver falha de aplicação.
- A migração de banco é aditiva e mantém compatibilidade de escrita com estados
  legados por meio da normalização, mas seu rollback não deve ser improvisado.
  Uma reversão de dados exige diagnóstico e SQL específico.

## Ponto de controle

O próximo passo permitido é preparar o deployment sem tráfego público. A
aplicação do SQL em produção e a promoção para os domínios públicos exigem uma
confirmação final explícita do responsável.
