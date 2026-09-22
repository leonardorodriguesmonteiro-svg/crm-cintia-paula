# Entrega do acompanhamento e acesso manual no ERP

## Alterações
- AES-256-GCM permite recuperar o token no ERP, com AAD vinculada ao pedido.
  A consulta pública continua usando somente SHA-256 e verificando validade/revogação.
- Ver/copiar reutiliza o link. Substituir e revogar exigem confirmação explícita.
  Links antigos sem cifra exigem substituição explícita; nunca são invalidados silenciosamente.
- Link aparece dentro do cartão do pedido, com copiar, abrir mensagem no WhatsApp,
  enviar por Resend e enviar por API WhatsApp. Nenhum envio é feito ao apenas consultar.
- Pedidos novos agendam envio via Next after; falha de comunicação não desfaz o pedido.
- Consentimento opcional e desmarcado nos dois formulários públicos; sem ele,
  WhatsApp automático é bloqueado. Pedidos antigos não ganham consentimento retroativo.
- Registro server-only por pedido/token/canal; claim atômico impede envios concorrentes.
  Resend usa chave de idempotência; requisições aceitas não são reenviadas.
- Falhas de rede e HTTP 5xx ficam incertas e não são repetidas automaticamente.
  Respostas 4xx, configuração ausente e contato inválido permitem nova tentativa explícita.
- Status aceito significa aceito pela API, não entregue/lido. Não há webhook de entrega,
  cron de retentativas ou envio em lote. Interrupção do after pode exigir ação manual no ERP.

## Validação e ativação
- 20 testes locais passaram; TypeScript e build Next.js passaram.
- Migração docs/changes/acompanhamento_envios.sql aplicada na produção em 22/09/2026.
- RLS ativo nas duas tabelas, anon/authenticated sem SELECT e service_role com acesso.
- Resend já configurado na Vercel Production. Entrega real deve ser verificada após publicar.
- Empresa usa WhatsApp Business aplicativo. Botão manual abre a mensagem para revisão
  e envio; ação automática só aparece quando uma API for configurada.
- WhatsApp automático requer WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_GRAPH_VERSION e WHATSAPP_TEMPLATE_NAME; idioma padrão pt_BR.
  Template aprovado: dois parâmetros no corpo (número do pedido e link completo).
  Confirmar contrato e versão suportada da API antes de ativar. Integração ainda não
  validada contra conta real de WhatsApp.
- ACOMPANHAMENTO_ENCRYPTION_KEY pode definir uma chave dedicada estável. Na ausência,
  usa derivação da SUPABASE_SERVICE_ROLE_KEY com contexto exclusivo. Alterar a chave
  depois exige migrar cifras ou substituir links explicitamente. Hashes públicos
  existentes continuam válidos até expirar ou revogar.
- Não há webhook de entrega, cron de retentativas ou disparo em lote. Status aceito
  não significa entregue. Envio incerto exige conferência no provedor antes de repetir.
