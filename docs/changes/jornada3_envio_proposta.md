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

## Publicação — 08/10/2026

- Commit da aplicação: `0ed1da6333e3e00b7b9eedb824adec891685b3a9`.
- Homologação READY: `dpl_HDQCuNfK8fBNr2DRjEUXzYiGSqcH`.
- Produção READY e promovida: `dpl_AReS16BxvuXrQNkUwGpzerFMPGnA`; build Next.js de 43 segundos.
- Domínio ERP confirmado por `vercel inspect`: https://erp.cintiapaulafestaedecoracao.com.br/orcamentos.
- Migração de produção: `20261008192410_jornada3_envio_proposta`.
- Teste SQL completo também aprovado em produção com rollback. Antes/depois: 4 orçamentos, 14 itens, total 1100,90, 9 reservas e 63 itens de estoque.
- RPCs alteradas: EXECUTE permitido a service_role; negado a anon e authenticated.
- HTTP: página /orcamentos 200; proposta inexistente 404; envio sem sessão 401.
- Consulta de logs error/fatal da versão não retornou registros na janela de 15 minutos após a publicação. Não representa monitoramento contínuo.
- Rollback de aplicação disponível: `dpl_5VLbBmj9bjQGxCW7EDFJC8E8Jmtd`. A migração mantém compatibilidade com os estados legados.
