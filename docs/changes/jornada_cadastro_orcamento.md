# Cadastro antes do orçamento e preços de locação

## Comportamento
- Estoque possui preço de locação opcional e independente do valor de reposição. Nenhum preço foi inventado ou convertido de reposição.
- Novas pré-reservas preservam o preço de locação no snapshot; antigas sem referência usam o preço cadastrado ao preparar orçamento. Um snapshot explícito de zero é preservado.
- Orçamento permite editar unitários sem alterar o catálogo. Valores ausentes exigem preenchimento explícito.
- Aprovação envia e-mail com o link privado de acompanhamento para cadastro. Registro separado e idempotente evita que o aviso de recebimento suprima o aviso de aprovação.
- ERP mantém link copiável, situação cadastral e mensagem pronta para envio manual no aplicativo WhatsApp Business.
- Cadastro exige CPF válido, e-mail e endereço. Somente o token privado vigente, pedido aprovado e empresa correta permitem concluir. Não retorna CPF/endereço na consulta pública.
- Uma transação cria uma ficha cadastral específica da solicitação, vincula pedido e rascunhos, e registra conclusão. Não pesquisa nem sobrescreve outros clientes por CPF/telefone. A equipe pode encontrar uma ficha anterior do mesmo cliente; conciliação global de clientes não está incluída.
- Salvar rascunho não envia. Finalizar e enviar salva, valida cadastro e disponibiliza proposta com envio de e-mail. Falhas no envio preservam o orçamento e são informadas.
- Cadastro antecipado é reutilizado no aceite. Propostas antigas já enviadas continuam no fluxo anterior. Confirmação da reserva continua condicionada à formalização existente.
- O preço de locação não cadastrado continua em branco. Os quatro itens de PRÉ-0015 precisam receber seus preços reais no estoque ou no orçamento.

## Validação
- 26 testes Node passaram, incluindo isolamento entre e-mail de recebimento e aprovação, proteção de token, validação de dados e formulário por etapa.
- TypeScript e build Next.js passaram.
- Migração `cadastro_antes_orcamento` aplicada em produção via Supabase; grants e RLS conferidos. Tabela de envios é intencionalmente server-only.
- Teste transacional `teste_cadastro_transacional.sql` passou: etapas, empresa, revogação/expiração, idempotência, bloqueio de envio, aceite sem segundo cadastro e preço. Todos os registros de teste foram desfeitos por rollback.
- Nenhum e-mail real de teste foi disparado por essa validação de banco. Aceito pelo serviço não confirma entrega.
