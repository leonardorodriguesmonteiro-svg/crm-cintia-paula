# Homologação do Supabase — 24/08/2026

## Resultado executivo

O projeto remoto `CRM Cintia Paula` está saudável, mas o histórico de migrações
registrado no Supabase diverge do histórico presente neste repositório. Por esse
motivo, `supabase db push` está temporariamente bloqueado: ele pode reaplicar
regras já existentes, substituir funções mais novas ou produzir um schema que
não corresponde ao banco de produção.

Nenhuma alteração foi aplicada ao banco de produção durante este levantamento.
O schema reconciliado e a jornada completa foram validados exclusivamente no
projeto isolado de homologação.

## Ambiente isolado

- Projeto: `CRM Cintia Paula - Homologação`
- Project ref: `iwcdrexhwiuycfdbitnw`
- Região: `sa-east-1`
- Custo informado pelo Supabase na criação: `US$ 0/mês`
- Estado inicial: saudável e sem tabelas no schema `public`

Esse projeto é independente da produção e receberá somente schema reconciliado
e dados fictícios de teste. Nenhum dado de cliente será copiado automaticamente.

### Execução realizada

- A base histórica até a migração 038 foi executada em banco vazio.
- As 17 migrações registradas na produção foram reproduzidas na mesma ordem.
- As consolidações da esteira e da formalização foram aplicadas.
- O teste transacional de banco foi aprovado e seus primeiros dados fictícios
  foram revertidos ao final.
- Um segundo cenário sintético percorreu a aplicação completa: pré-reserva,
  análise, proposta, envio, aceite, dados cadastrais, contrato, sinal e reserva.
- O resultado final foi conferido no banco: proposta `ACEITA`, formalização
  `RESERVA_CONFIRMADA`, reserva `Confirmada`, contrato `Assinado` e sinal `Pago`.
- A confirmação direta da reserva foi bloqueada como esperado.
- O finalizador exclusivo confirmou somente após contrato assinado, sinal pago
  e revalidação da disponibilidade.

### Inconsistências corrigidas durante a homologação

- Migração 004 presumia colunas legadas de reservas em instalações novas.
- `recebimentos`, `contratos`, `empresas` e `usuarios_empresa` não faziam parte
  da criação limpa, embora módulos posteriores dependessem delas.
- A consolidação de estoque presumia colunas existentes apenas na V3.
- O RBAC tentava criar políticas nas tabelas legadas `estoque`, `temas` e no
  motor antigo de workflow, recriando dependências já substituídas.
- Um confirmador experimental concorria com o finalizador V2 e foi removido;
  agora há um único responsável pela confirmação da reserva.
- Funções internas `SECURITY DEFINER` deixaram de ser executáveis por `anon`;
  a contagem verificada no ambiente de homologação passou para zero.
- A chave de servidor da Vercel foi corrigida sem expô-la ao frontend.
- A formalização passou a usar exclusivamente a rota autenticada do servidor.
- Propostas em rascunho deixaram de exibir uma ação pública de aceite.

## Evidências

- Projeto remoto: `pxhgfyvpzbcjymmnoyuo`, região `sa-east-1`, PostgreSQL 17.
- O remoto registra 17 migrações entre `20260814221243` e `20260822174637`.
- Essas versões não existem na pasta local `supabase/migrations`.
- A pasta local contém versões com nomes semelhantes, mas timestamps e
  assinaturas SQL diferentes.
- O remoto já possui regras posteriores para formalização, confirmação,
  chave secreta de RPCs e reserva simplificada que não estão registradas no Git.

Migrações remotas críticas ausentes localmente:

- `formalizacao_comercial_v2`
- `guarda_confirmacao_v2`
- `finalizador_exclusivo_v2`
- `secret_key_server_rpcs`
- `dados_cliente_completos_v2`
- `email_obrigatorio_jornada_comercial`
- `hardening_formalizacao_email`
- `reserva_simplificada_estoque_os`

## Estado funcional encontrado

Apesar das regras V2, os dados ainda usam parte do vocabulário legado:

- oportunidades: `Fechado` (1)
- orçamentos: `Aprovado` (1), `Rascunho` (1)
- formalização: `Venda confirmada` (1), sem status (1)
- reservas: `Confirmada` (3), `Concluída` (3), `Cancelada` (2)

Isso confirma que a simplificação precisa preservar compatibilidade durante a
transição; não é seguro trocar constraints e funções antes de reconciliar o
schema efetivo.

## Segurança

Foram encontradas funções `SECURITY DEFINER` executáveis pelo papel `anon`.
Algumas são funções de trigger ou helpers internos e não precisam ser chamadas
diretamente pela API, por exemplo:

- `auditar_empresa`, `auditar_entidade_operacional`, `auditar_evidence_engine`
- `recalcular_orcamento_por_itens`, `recalcular_reserva_por_itens`
- `gerar_codigo_automatico_estoque`, `proximo_numero_reserva`
- `registrar_preferencia_mercado_pago`

O hardening deve revogar `EXECUTE` de `anon`/`public` nas funções internas e
conceder apenas às funções públicas estritamente necessárias. A revogação será
feita somente após mapear todas as chamadas do site e do ERP.

## Plano seguro para produção

1. Gerar e validar um backup recuperável do banco de produção.
2. Exportar e versionar as 17 migrações efetivamente registradas no remoto.
3. Comparar as versões remotas com as migrações locais equivalentes.
4. Reconciliar timestamps sem reaplicar SQL em produção.
5. Revisar o SQL pendente e executar os advisors de segurança e desempenho.
6. Registrar consultas de verificação e passos de rollback por migração.
7. Aplicar as migrações numa janela de baixo movimento.
8. Publicar a aplicação, executar um smoke test e acompanhar os logs.

## Critério de aceite

Site/ERP → pré-reserva → análise → proposta → aceite → dados completos →
contrato → sinal conciliado → reserva confirmada → estoque/OS.

Em cada passagem deve existir uma única ação responsável pelo avanço, com
idempotência e trilha de auditoria. A proposta aceita não pode confirmar reserva
antes de contrato e pagamento, e nenhuma tela deve gravar estados legados.
