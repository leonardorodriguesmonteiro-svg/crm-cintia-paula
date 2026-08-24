# Plano de promoção para produção — 24/08/2026

## Escopo

Promover a esteira única validada na homologação:

`pré-reserva → proposta → aceite → dados → contrato → sinal → reserva confirmada`

Este documento não autoriza nem executa alterações em produção.

## Portões obrigatórios

- [ ] Backup recuperável do banco de produção concluído e identificado.
- [ ] Procedimento de restauração testado ou confirmado pelo provedor.
- [ ] Histórico das 17 migrações remotas reconciliado com o repositório.
- [ ] SQL pendente revisado por ordem e impacto.
- [ ] Advisors de segurança e desempenho sem alerta impeditivo.
- [ ] Mercado Pago e Resend decididos e configurados separadamente por ambiente.
- [ ] Janela de implantação e responsáveis definidos.

## Ordem de implantação

1. Congelar gravações administrativas durante a janela.
2. Registrar contagens e estados antes da alteração.
3. Aplicar somente as migrações ainda não executadas, na ordem cronológica.
4. Repetir as consultas de contagem e integridade.
5. Publicar a aplicação sem promover variáveis da homologação.
6. Executar o smoke test com um registro fictício claramente identificado.
7. Monitorar erros de API, autenticação e banco durante a primeira operação.

## Verificações mínimas

- A criação da pré-reserva é idempotente.
- Estados legados não podem voltar a ser gravados.
- Proposta em rascunho não aceita resposta pública.
- Proposta enviada aceita uma única resposta.
- CPF e endereço são solicitados somente depois do aceite.
- Formalização gera uma única reserva, contrato e lançamento de sinal.
- Reserva não confirma sem contrato assinado, sinal pago e disponibilidade.
- `anon` não executa funções internas `SECURITY DEFINER`.
- A chave de servidor não aparece em variáveis `NEXT_PUBLIC_*` nem no bundle.

## Critério de rollback

Interromper a promoção se houver erro de autenticação, quebra de RLS, perda de
relacionamentos, duplicação de reserva/contrato/cobrança ou avanço indevido de
estado. Nesse caso:

1. não executar migrações adicionais;
2. retirar o novo deploy do tráfego;
3. preservar logs e evidências da falha;
4. avaliar reversão SQL específica para mudanças aditivas;
5. restaurar o backup somente se a integridade dos dados não puder ser
   recuperada de forma incremental.

## Fora desta promoção

- Exclusão do projeto de homologação.
- Ativação automática de cobrança real.
- Envio automático de e-mails sem domínio e remetente validados.
- Limpeza de dados históricos ou estados legados em produção.
