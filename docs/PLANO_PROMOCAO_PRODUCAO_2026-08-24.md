# Plano de promoção para produção — 24/08/2026

## Escopo

Promover a esteira única validada na homologação:

`pré-reserva → proposta → aceite → dados → contrato → sinal → reserva confirmada`

Este documento não autoriza nem executa alterações em produção.

## Portões obrigatórios

- [x] Dump manual do banco de produção concluído, identificado e validado por
      SHA-256 (o plano Free atual não oferece backup agendado).
- [ ] Procedimento de restauração testado ou confirmado pelo provedor.
- [x] Conteúdo das 17 migrações remotas exportado e versionado como evidência.
- [x] Diferenças entre migrações remotas e locais classificadas por impacto.
- [x] SQL pendente revisado por ordem e impacto.
- [x] Advisors de segurança e desempenho levantados e classificados.
- [ ] Mercado Pago e Resend decididos e configurados separadamente por ambiente.
- [ ] Janela de implantação e responsáveis definidos.

## Bloqueio atual

O painel remoto registra 17 migrações com versões que não existem na pasta
local. Seis possuem nomes funcionalmente equivalentes a arquivos locais, mas
somente uma é byte a byte idêntica; as outras onze não têm arquivo com o mesmo
nome. Até que as diferenças sejam classificadas e o dump manual esteja
concluído, ficam proibidos `supabase db push`, reparo do histórico e aplicação
manual de SQL em produção.

### Tentativa de backup em 24/08/2026

- O acesso temporário ao Postgres foi habilitado com sucesso pela CLI.
- A conexão ao projeto e o `migration fetch` foram validados.
- O `db dump` não iniciou porque a CLI local exige Docker Desktop para executar
  o `pg_dump`, e o equipamento não possui Docker nem `pg_dump` instalado.
- O arquivo parcial vazio foi removido e o token temporário foi revogado sem ter
  sido usado para qualquer alteração no banco.
- Há aproximadamente 2 GiB livres no disco; instalar Docker não é recomendável
  nesse estado. A alternativa preferencial é instalar somente um cliente
  PostgreSQL 17 compatível ou liberar espaço antes de instalar o Docker.

### Backup concluído em 24/08/2026

Após a liberação de espaço, o cliente PostgreSQL 17.11 oficial foi montado
temporariamente e os dumps foram gerados em:

`/Users/macbookair/Documents/CP Festas/backups/crm-cintia-paula/2026-08-24`

Arquivos validados: `roles.sql`, `schema.sql`, `data.sql` e `MANIFESTO.txt`.
O dump contém os schemas gerenciados e próprios, incluindo `auth.users`, dados
do ERP/site e o histórico `supabase_migrations`. Os arquivos possuem permissão
local `0600`, hashes SHA-256 registrados e não contêm credenciais temporárias.
Os papéis efêmeros e o token `Full access` foram revogados após a operação.

Permanece pendente testar a restauração em um projeto isolado. Há uma relação
circular entre `reservas` e `orcamentos`, que exige restauração controlada dos
dados com triggers temporariamente desabilitados ou tratamento equivalente.

### Pacote de promoção consolidado em 24/08/2026

O SQL revisado e a validação posterior estão em
`docs/evidencias/promocao-producao-2026-08-24/`. O pacote preserva a função
endurecida de formalização já existente em produção. A versão local que a
recriava foi excluída por remover o isolamento por empresa e a validação do
e-mail do cliente; a correção de autorização subsequente também foi excluída
porque procurava um trecho inexistente e poderia abortar a transação.

Não houve execução em produção. Continuam pendentes o ensaio de restauração,
a correção dos avisos impeditivos e a definição da janela de implantação.

Para liberar o próximo portão, usar a CLI oficial autenticada para:

1. obter a senha do Postgres de produção de forma segura;
2. gerar dumps separados de schema, dados e papéis/roles;
3. classificar as diferenças já exportadas entre o remoto e o Git;
4. montar o plano final contendo somente SQL ainda não aplicado.

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
