# Site oficial: acompanhamento e UX

Base: produção f1aa98f1de521cc8682fa1f812514e80b55d2f1f, projeto Vercel crm-cintia-paula-v3-supabase.

- Pré-reservas: atualização manual, a cada 30 segundos e ao retornar à página; falhas nos cadastros auxiliares não apagam os pedidos carregados.
- Acompanhamento: token aleatório de 256 bits no fragmento do link; somente SHA-256 no banco; validade de um ano, substituição e revogação pelo Comercial/Administrador da empresa.
- API pública valida origem, tamanho, limite de consultas, validade, revogação e empresa. Resposta mínima sem nome, telefone, e-mail, CPF ou observações internas. Propostas em rascunho não são liberadas.
- A página mostra status existentes no ERP. Pagamento e operação são exibidos separadamente; não presume reserva confirmada nem realiza transações.
- Solicitações novas recebem o link na confirmação. Pedidos anteriores ou links perdidos precisam de emissão pela equipe no painel. Não há envio automático de mensagem nem recuperação por número/e-mail.
- Site: acesso no menu, home, rodapé e confirmação; página para colar o link privado; textos distinguem pedido de confirmação. Menu mobile usa dialog nativo para foco e teclado.

## Banco
Aplicar `docs/changes/acompanhamento_links.sql` antes da publicação. Mudança aditiva, sem alterar clientes, pedidos ou estoque. Nenhuma permissão pública sobre a nova tabela; acesso somente no servidor.

## Validação
- TypeScript passou.
- Build Next.js 16.2.12 passou com variáveis fictícias, sem consultar produção.
- 11 testes novos de autorização/expiração/privacidade + 3 testes da jornada passaram.
- Verificação visual local bloqueada pelo navegador remoto; verificar na publicação de validação.

## Limitações
- Status depende de atualização operacional no ERP; não é conciliação automática de pagamento.
- Falha de geração do link não transforma pedido salvo em erro: a confirmação orienta contato com a equipe.
- Reenvio idempotente não reemite token; equipe gera link novo se a primeira resposta se perder.
