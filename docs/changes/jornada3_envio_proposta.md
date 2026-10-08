# Jornada 3: envio e aceite da proposta

Orçamentos FINALIZADO podem ser disponibilizados pelo link ou pelo envio de e-mail existente. O contato preliminar do editor fornece nome, telefone e destinatário. A proposta pública apresenta valores negociados, descontos por item, taxas e indicação de itens conceituais.

Cancelar um envio sem resposta invalida o token e retorna o orçamento da Jornada 3 para EM_EDICAO. Após revisão e finalização, um novo envio usa o novo token. O fluxo legado ligado à oportunidade mantém RASCUNHO/APROVADA. Configuração e destinatário do e-mail são verificados antes de disponibilizar a proposta. Nenhum e-mail real foi enviado durante a validação.

O aceite usa o fluxo público existente. O formulário posterior agora aceita orçamento direto sem oportunidade, criando o cliente a partir do contato preliminar. Documento já cadastrado sem vínculo pede revisão pela equipe; não altera outro cadastro silenciosamente. A operação repetida é idempotente.

## Validação

- 47 testes unitários; TypeScript e build local aprovados.
- PGlite: envio direto e legado, repetição, cancelamento, rotação de token, refinalização, validade, autorização, bloqueio após resposta e cadastro após aceite.
- Homologação: teste SQL transacional da criação pelo editor até envio, cancelamento, refinalização, aceite e cadastro completo; rollback integral e contagens de estoque/reservas preservadas.
- Teste de envio ao provedor substituído por dependências controladas; entrega de e-mail não verificada.
- Teste visual autenticado depende de sessão do ERP; não realizado nesta execução.
