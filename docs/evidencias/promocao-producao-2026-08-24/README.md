# Pacote de promoção — 2026-08-24

Este pacote foi derivado do backup validado de produção e das seis migrações
locais posteriores à homologação.

## Decisão de consolidação

- Incluído: normalização definitiva das etapas de oportunidades.
- Incluído: normalização definitiva dos estados de propostas/formalização.
- Incluído: índices das consultas da nova esteira.
- Incluído: compatibilidade `empresas.status` e hardening das funções internas.
- Excluído: recriação de `executar_formalizacao_servidor`. A versão existente em
  produção é mais nova e preserva isolamento por empresa e validação do e-mail.
- Excluído: remoção dos confirmadores experimentais. Eles não existem no schema
  exportado de produção.
- Excluído: a migração `corrigir_autorizacao_formalizacao`, pois procura um trecho
  ausente e abortaria sem produzir uma alteração válida.

## Ordem segura

1. Confirmar que o backup de 2026-08-24 continua disponível e íntegro.
2. Executar `001_esteira_comercial_consolidada.sql` em uma única transação.
3. Executar `002_validacao_pos_promocao.sql` e guardar a saída.
4. Fazer o smoke test da jornada: entrada, proposta, aceite, dados do cliente,
   contrato, sinal e confirmação da reserva.

O arquivo 001 contém uma guarda que interrompe a transação se a função endurecida
de formalização não corresponder ao schema analisado.
