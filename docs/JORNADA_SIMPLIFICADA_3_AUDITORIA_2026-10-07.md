# Jornada Simplificada 3.0 — Auditoria técnica e plano de implementação

**Data da auditoria:** 07/10/2026  
**Repositório:** `leonardorodriguesmonteiro-svg/crm-cintia-paula`  
**Branch auditada:** `feat/esteira-comercial-v2-integrada`  
**Commit auditado:** `c6558b55e3e076e03862fe93f5485c5767dabbdb`  
**Escopo desta etapa:** leitura e diagnóstico. Nenhuma migration, alteração de banco ou publicação foi executada.

## 1. Conclusão executiva

O backlog da Jornada Simplificada 3.0 é compatível com a arquitetura existente, mas a implementação não deve começar por mudanças visuais isoladas. Há três questões estruturais a resolver primeiro:

1. A entrada comercial está dividida entre `oportunidades` e `orcamentos`. O site cria uma pré-reserva em `oportunidades`, que só depois é convertida em orçamento. Essa duplicidade é a principal origem da jornada longa e confusa.
2. O histórico de migrations local, de produção e de homologação não está canonicamente alinhado. Há migrations aplicadas remotamente com nomes e conteúdos diferentes dos arquivos versionados. Reexecutar o histórico local sem reconciliação é arriscado.
3. O processo de entrega está disperso entre dois projetos Vercel. Produção e homologação não estão no mesmo commit e a configuração local aponta para homologação, enquanto os previews automáticos são gerados em outro projeto.

A direção recomendada é tornar `orcamentos` o agregado comercial canônico. Solicitações do site, WhatsApp, Instagram, telefone, indicação e lançamentos manuais passam a criar um orçamento diretamente. `oportunidades` permanece preservada como legado e auditável, sem exclusão de registros.

## 2. Regra inviolável para itens conceituais

Um item conceitual representa uma intenção criativa ou futura aquisição. Ele não é estoque e não participa de disponibilidade, bloqueio, reserva, baixa ou cálculo de quantidade disponível.

As garantias técnicas devem ser cumulativas:

- `itens_conceituais` não terá coluna de quantidade disponível usada pelo motor de estoque;
- nenhuma trigger poderá criar ou incrementar `estoque_itens` a partir de item conceitual;
- nenhuma confirmação de orçamento, contrato, reserva ou missão converterá o item automaticamente;
- a conversão ocorrerá somente pela ação explícita **Incorporar ao estoque**;
- a ação usará operação transacional e idempotente, com autorização RBAC, auditoria e vínculo ao item real criado;
- após a conversão, `convertido_item_estoque_id` impedirá conversões duplicadas;
- a disponibilidade do site continuará consultando exclusivamente itens reais publicados e disponíveis.

## 3. Estado verificado do código e da entrega

### 3.1 Git e GitHub

- Branch atual limpa e sincronizada: `feat/esteira-comercial-v2-integrada`.
- A branch está 165 commits à frente de `origin/main`, sem commits exclusivos em `main`.
- `main` está desatualizada em relação ao produto atualmente testado.
- Existem quatro pull requests draft antigos e encadeados, o que dificulta identificar a linha oficial de release.
- Nenhuma alteração foi feita em `main` ou `feat/consolidacao-v3-v6`.

Antes da promoção definitiva, deverá ser aberta uma linha de release única a partir da branch integrada, com comparação clara contra produção e sem reaproveitar cegamente a cadeia antiga de PRs.

### 3.2 Vercel

- Projeto de produção: `crm-cintia-paula-v3-supabase`.
- O deployment de produção está `READY`, mas utiliza o commit `9fe8225`.
- O preview mais recente da branch auditada está `READY` no commit `c6558b5`.
- O projeto de homologação está `READY`, porém utiliza o commit `a697374`, anterior à branch atual.
- O arquivo local `.vercel/project.json` aponta para homologação; os previews automáticos também aparecem no projeto de produção.

Consequência: homologação não representa exatamente o código auditado. A Sprint 0 deverá definir um único fluxo de preview, homologação e promoção, sem trocar credenciais ou domínios de produção.

### 3.3 Qualidade do baseline

- `npm test`: 28 testes aprovados.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado com Next.js 16.2.12.
- Nenhuma alteração local pendente no início da auditoria.

## 4. Inventário de preservação

Os seguintes volumes foram conferidos diretamente nos bancos. Eles formam o mínimo obrigatório para backup, reconciliação e validação pós-migração.

| Entidade | Produção | Homologação |
|---|---:|---:|
| Clientes | 15 | 1 |
| Kits | 53 | 1 |
| Itens de estoque | 63 | 1 |
| Reservas | 9 | 1 |
| Contratos | 4 | 1 |
| Orçamentos | 4 | 1 |
| Itens de orçamento | 14 | 1 |
| Oportunidades | 6 | 2 |
| Itens de oportunidade | 12 | 2 |
| Logs de auditoria | 1.189 | 48 |
| Objetos no Storage | 112 | 2 |

Buckets de produção:

- `catalogo-fotos`: público, 111 objetos;
- `logos-empresa`: público, 1 objeto;
- `contratos`: privado, sem objetos;
- `assinaturas-missao`: privado, sem objetos;
- `evidencias-missao`: privado, sem objetos;
- `ocorrencias-missao`: privado, sem objetos.

Nenhuma Sprint poderá usar `DROP`, `TRUNCATE`, exclusão em massa ou substituição destrutiva desses dados. Toda evolução será aditiva, com backfill verificável e período de compatibilidade.

## 5. Mapa do fluxo comercial atual

```text
Site / ERP
   |
   v
POST /api/publico/pre-reservas
   |
   v
oportunidades + oportunidade_itens
   |
   +--> RECEBIDA -> EM_ANALISE -> AJUSTE_SOLICITADO
   |                  |                    |
   |                  +--> RECUSADA        |
   |                                       v
   +-------------------------------> APROVADA
                                           |
                                           v
                                 CONVERTIDA_EM_PROPOSTA
                                           |
                                           v
                              orcamentos + orcamento_itens
                                           |
                         RASCUNHO -> ENVIADA -> ACEITA
                                           |
                                           v
                              complemento externo de dados
                                           |
                                           v
                        contrato -> assinatura -> pagamento
                                           |
                                           v
                                 RESERVA_CONFIRMADA
```

O fluxo preserva auditoria e formalização, mas duplica o conceito comercial em duas estruturas e exige conversões que não acrescentam valor para a operação desejada.

## 6. Rotas reais impactadas

### 6.1 Site e jornada pública

- `/`
- `/site`
- `/site/kits`
- `/reservar`
- `/acompanhar`
- `/proposta/[token]`
- `/contrato/[token]`
- `/api/catalogo`
- `/api/publico/pre-reservas`
- `/api/publico/acompanhamento`
- `/api/publico/acompanhamento/cadastro`
- `/api/propostas/[token]`
- `/api/propostas/[token]/dados-cliente`

### 6.2 ERP comercial

- `/comercial`
- `/orcamentos`
- `/clientes`
- `/contratos`
- `/reservas`
- `/reservas/[id]`
- `/api/comercial/pre-reservas`
- `/api/comercial/pre-reservas/[id]/transicoes`
- `/api/comercial/pre-reservas/[id]/valores`
- `/api/comercial/propostas/[id]/enviar`
- `/api/orcamentos/[id]/enviar-email`
- `/api/orcamentos/[id]/cancelar-envio`
- `/api/orcamentos/[id]/formalizacao`

### 6.3 Catálogo, estoque e kits

- `/estoque`
- `/kits`
- `/kits/composicao`
- componentes públicos de catálogo, destaques, reserva e resumo da seleção.

## 7. Tabelas reais impactadas

### Núcleo atual

- `clientes`
- `oportunidades`
- `oportunidade_itens`
- `orcamentos`
- `orcamento_itens`
- `kits`
- `kit_itens`
- `estoque_itens`
- `contratos`
- `reservas`
- `auditoria_logs`
- tabelas de Timeline, Workflow e Event Bus já existentes.

### Estruturas novas propostas

- `orcamento_taxas`
- `itens_conceituais`
- `composicoes_ia`
- `composicao_itens`
- `compras_itens`

## 8. Divergências entre o backlog e o sistema atual

| Tema | Situação atual | Jornada 3.0 |
|---|---|---|
| Entrada comercial | Site cria pré-reserva/oportunidade | Site cria solicitação de orçamento |
| Agregado principal | Oportunidade e orçamento | Orçamento único e canônico |
| Preços no site | API e componentes expõem preços e subtotais | Site sem preço, subtotal, total ou desconto |
| Edição de orçamento | Cálculo e persistência dentro do React | Regras na Application Layer e persistência atômica |
| Cliente | Complementação externa por link | Cadastro/complemento interno pela Cintia |
| Taxas | `acrescimos` e `frete` no cabeçalho | Taxas independentes, descritas e auditáveis |
| Preço de item | Um único valor persistido | Snapshot de preço-base e preço negociado separados |
| Item conceitual | Inexistente | Entidade própria, sem disponibilidade de estoque |
| IA | Sem composição estruturada canônica | Composição versionada; dados estruturados são a verdade |
| Publicação | Catálogo deriva diretamente de kits/estoque | Publicação explícita e validada |
| Migrations | Histórico local e remoto divergente | Baseline reconciliado antes de qualquer evolução |

## 9. Riscos técnicos encontrados

### 9.1 Editor de orçamentos

`components/comercial/OrcamentosPage.tsx` concentra interface, regras de cálculo, leitura e gravação no Supabase. O salvamento atual atualiza o cabeçalho, apaga os itens e depois os reinsere. Em caso de falha intermediária, um orçamento pode ficar parcialmente salvo.

Correção: mover cálculo, validação e persistência para casos de uso e repositórios do servidor. O salvamento do agregado deverá ser transacional.

### 9.2 Exposição pública de preços

`/api/catalogo` retorna preços de kits e itens de estoque, e habilita CORS público. Ocultar apenas o valor na interface não resolve. A resposta pública deve deixar de conter esses campos.

### 9.3 Migrations e ambientes

Produção e homologação possuem migrations aplicadas que não correspondem integralmente à pasta `supabase/migrations`. O risco é duplicar objetos, reaplicar alterações ou produzir uma homologação diferente de produção.

### 9.4 Segurança

O banco possui RLS habilitada nas tabelas públicas verificadas, mas os advisors indicam:

- tabelas com RLS sem policies, algumas potencialmente intencionais por serem server-only;
- funções `SECURITY DEFINER` executáveis por `authenticated`, que exigem revisão de grants e validação interna;
- proteção contra senhas vazadas desabilitada;
- chaves estrangeiras sem índice e policies permissivas/duplicadas em pontos do esquema.

As correções devem ser tratadas por risco e testadas primeiro em homologação. Nenhuma RLS será desativada e a service role continuará restrita ao servidor.

## 10. Modelo alvo recomendado

### 10.1 Orçamento como agregado canônico

`orcamentos` passa a receber diretamente todas as origens:

- SITE;
- MANUAL;
- WHATSAPP;
- INSTAGRAM;
- TELEFONE;
- INDICACAO;
- OUTRO.

O orçamento poderá nascer apenas com nome, telefone, e-mail opcional, data do evento, interesse e seleção preliminar. `cliente_id` permanece opcional até o cadastro interno. Assim não é necessário criar uma terceira tabela de contato preliminar.

`oportunidades` e `oportunidade_itens` serão preservadas como legado. Registros existentes serão associados ou migrados de forma idempotente para orçamentos, com uma referência de origem. Depois do cutover, a interface deixa de criar novas oportunidades.

### 10.2 Estados

Para evitar nova duplicação, o estado comercial e o estado de formalização devem permanecer separados.

**Orçamento:**

- `NOVO`
- `EM_EDICAO`
- `FINALIZADO`
- `CANCELADO`

**Formalização:**

- `AGUARDANDO_CLIENTE`
- `CLIENTE_CADASTRADO`
- `CONTRATO_GERADO`
- `CONTRATO_ENVIADO`
- `AGUARDANDO_ASSINATURA`
- `ASSINADO`
- `AGUARDANDO_PAGAMENTO`
- `PRONTO_PARA_CONFIRMAR`
- `RESERVA_CONFIRMADA`
- `CANCELADA`

A interface pode exibir rótulos amigáveis derivados desses estados. Contrato e pagamento continuam sendo fontes próprias de verdade; não se deve copiar o mesmo status para várias tabelas.

### 10.3 Itens e valores

Evolução aditiva de `orcamento_itens`:

- `tipo_origem`: KIT, ESTOQUE, LIVRE ou CONCEITUAL;
- `preco_base`: snapshot do valor vigente ao inserir o item;
- `preco_unitario_orcamento`: valor efetivamente negociado;
- `item_conceitual_id`: vínculo opcional;
- `desconto_valor` e/ou regra normalizada de desconto;
- `observacao`.

O valor cadastrado em estoque ou kit não será alterado por uma negociação. O orçamento guarda seu próprio snapshot e valor negociado.

`orcamento_taxas` armazenará descrição, tipo, valor, ordem e observação. `frete` e `acrescimos` antigos serão mantidos durante a compatibilidade, com backfill e leitura dupla controlada até a retirada segura.

### 10.4 Itens conceituais

Campos mínimos propostos:

- `id`, `empresa_id`, `nome`, `descricao`, `categoria`;
- `status`: RASCUNHO, APROVADO, EM_COMPRA, ADQUIRIDO, INCORPORADO ou CANCELADO;
- `imagem_referencia_url`, `custo_estimado`, `fornecedor_sugerido`;
- `convertido_item_estoque_id`, `incorporado_por`, `incorporado_em`;
- campos padrão de criação, atualização e auditoria.

A RPC/caso de uso `incorporar_item_conceitual_ao_estoque` deverá:

1. verificar empresa, perfil e estado do item;
2. recusar nova conversão se já houver `convertido_item_estoque_id`;
3. criar o item real com os dados explicitamente confirmados pelo usuário;
4. vincular o item conceitual ao item real;
5. registrar auditoria, Timeline e evento de domínio;
6. concluir tudo na mesma transação.

### 10.5 IA e composições

- imagem gerada nunca substitui a imagem original automaticamente;
- cada geração é uma versão;
- a composição estruturada e seus itens são a fonte de verdade, não a imagem;
- salvar uma composição como kit exige ação explícita;
- publicar um kit no site exige ação explícita e validações de conteúdo e disponibilidade;
- itens conceituais permanecem conceituais mesmo quando aparecem em composição gerada por IA.

## 11. Migrations necessárias

As migrations deverão ser pequenas, reversíveis por compatibilidade e aplicadas primeiro em homologação.

1. **Baseline reconciliado**
   - documentar objetos e checksums dos ambientes;
   - criar migration de baseline somente após comparar schema local, produção e homologação;
   - não reaplicar migrations históricas divergentes.

2. **Orçamento canônico**
   - adicionar origem e snapshot de contato em `orcamentos`;
   - adicionar referência opcional à oportunidade legada;
   - índices por empresa, status, origem, telefone/e-mail e datas;
   - backfill idempotente dos registros existentes.

3. **Itens e taxas**
   - adicionar campos de origem, preço-base e preço negociado em `orcamento_itens`;
   - criar `orcamento_taxas` com RLS, índices, auditoria e `empresa_id`;
   - migrar valores legados sem remover colunas antigas.

4. **Itens conceituais e compras**
   - criar `itens_conceituais` e `compras_itens`;
   - criar vínculo opcional nos itens de orçamento e de composição;
   - implementar conversão explícita e idempotente para estoque.

5. **Composição por IA**
   - criar `composicoes_ia` e `composicao_itens`;
   - versionamento, autoria, empresa, status e referências de imagem;
   - nenhuma trigger de publicação ou estoque.

6. **Cutover e compatibilidade**
   - desativar criação de novas oportunidades somente depois de validar o orçamento direto;
   - manter leitura do legado durante a janela definida;
   - remover campos antigos apenas em Sprint futura e com aprovação específica.

## 12. Sequência de Sprints

### Sprint 0 — Preservação e baseline canônico

**Objetivo:** tornar a evolução segura antes de mudar comportamento.

- registrar tag/commit de recuperação;
- gerar backup lógico do banco de produção e inventário verificável do Storage;
- ensaiar restauração em ambiente isolado;
- reconciliar migration history local, produção e homologação;
- atualizar homologação para o commit auditado;
- documentar mapa de variáveis por ambiente sem expor segredos;
- definir um único fluxo Vercel de preview, homologação e produção;
- criar checklist e consultas de invariantes para clientes, kits, estoque, fotos, contratos e histórico.

**Saída:** baseline reproduzível, backup validado e caminho de rollback.

### Sprint 1 — Domínio e banco do Orçamento 3.0

- migrations aditivas de orçamento, itens e taxas;
- estados normalizados;
- backfill idempotente;
- RLS, grants, índices e auditoria;
- eventos `ORCAMENTO_CRIADO`, `ORCAMENTO_EDITADO`, `ORCAMENTO_FINALIZADO` e `ORCAMENTO_CANCELADO`;
- testes de integridade e multiempresa.

**Saída:** novo modelo disponível sem quebrar a interface atual.

### Sprint 2 — Application Layer e persistência atômica

- repositórios e casos de uso para criar, editar, finalizar e cancelar orçamento;
- cálculo centralizado de itens, descontos e taxas;
- endpoint/RPC transacional para salvar o agregado completo;
- idempotência e controle de concorrência;
- remover progressivamente regras e CRUD direto do componente React;
- testes unitários e de integração.

**Saída:** regras comerciais fora da apresentação e orçamento impossível de salvar pela metade.

### Sprint 3 — ERP comercial simplificado

- Orçamentos como entrada principal;
- criação manual e importação das origens externas;
- editor com kit, estoque, item livre e futuro item conceitual;
- preço-base visível internamente, preço negociado, desconto em R$ ou %, taxas e observações;
- cadastro/vínculo interno do cliente com prevenção de duplicidade;
- ação clara para gerar contrato;
- retirar Pré-reservas/Funil da navegação cotidiana, mantendo consulta histórica administrativa.

**Saída:** Cintia opera a jornada em uma única tela principal.

### Sprint 4 — Site sem preços e solicitação direta

- remover preços da resposta de `/api/catalogo`;
- remover preço, subtotal, total e desconto dos componentes públicos;
- renomear toda a comunicação para **Solicitar orçamento**;
- criar orçamento diretamente, sem nova oportunidade;
- confirmação imediata com código seguro de acompanhamento;
- acompanhamento com estados simples e pedidos de informação;
- manter rate limit, tokens privados e auditoria.

**Saída:** cliente escolhe, envia e acompanha sem burocracia e sem exposição de valores.

### Sprint 5 — Cliente interno, contrato e envio controlado

- cadastro/complementação feitos internamente no ERP;
- desativar novos links de complementação externa, preservando links históricos durante transição;
- geração de contrato a partir do orçamento finalizado;
- botões controlados para copiar link, enviar por e-mail/WhatsApp, reenviar e cancelar/inutilizar link;
- manter assinatura digital, pagamento e guarda de confirmação da reserva;
- Timeline completa da formalização.

**Saída:** fluxo orçamento -> cliente -> contrato -> assinatura sem etapas paralelas.

### Sprint 6 — Itens conceituais e lista de compras

- CRUD de itens conceituais;
- inclusão em orçamento e composição;
- estados de aprovação e aquisição;
- lista de compras e acompanhamento;
- ação exclusiva **Incorporar ao estoque**;
- auditoria e testes provando que item conceitual não altera disponibilidade.

**Saída:** criatividade comercial sem criar estoque fictício.

### Sprint 7 — Studio IA v1

- composições e itens estruturados;
- geração/versionamento de imagens;
- comparação entre original e variações;
- vínculo com orçamento, kit e item conceitual;
- aprovação humana obrigatória.

**Saída:** ferramenta criativa assistida, sem automações irreversíveis.

### Sprint 8 — Studio IA v2, kits e publicação

- transformar composição aprovada em kit por ação explícita;
- consolidar itens reais, livres e conceituais;
- fluxo de aquisição e incorporação;
- validações antes de publicar kit no site;
- publicação e despublicação auditadas.

**Saída:** ideia -> orçamento -> aquisição -> patrimônio -> catálogo, com controle humano em cada transição.

### Sprint 9 — Hardening, homologação e release

- corrigir advisors de segurança aplicáveis;
- revisar todas as policies RLS e funções `SECURITY DEFINER`;
- índices e análise de performance;
- testes E2E da jornada completa em desktop e mobile;
- ensaio de rollback e restauração;
- homologação com dados sintéticos e cenários de regressão;
- promoção controlada para produção e validação pós-release.

**Saída:** Jornada 3.0 publicada com evidências e caminho de recuperação.

## 13. Cenários mínimos de aceitação

1. Solicitação do site cria orçamento sem preço público.
2. Solicitação manual cria orçamento com a mesma estrutura.
3. Cliente sem CPF/endereço pode solicitar orçamento.
4. Administrador edita itens e preço negociado sem alterar o catálogo.
5. Desconto em R$ e em % produz total determinístico.
6. Taxas independentes aparecem no contrato conforme configuração.
7. Cadastro de cliente evita duplicidade por CPF/CNPJ/e-mail/telefone conforme regra aprovada.
8. Orçamento finalizado gera contrato somente por ação autorizada.
9. Cancelar envio invalida o link correto sem apagar o contrato.
10. Assinatura e pagamento mantêm rastreabilidade.
11. Reserva só é confirmada quando todas as guardas forem satisfeitas.
12. Item conceitual em orçamento não altera disponibilidade.
13. Item conceitual não pode ser incorporado duas vezes.
14. Incorporar ao estoque gera item real, auditoria e evento na mesma transação.
15. Falha durante salvamento não deixa cabeçalho e itens inconsistentes.
16. Usuário de outra empresa não acessa orçamento, cliente, item conceitual ou composição.
17. Imagem de IA nunca substitui original ou publica kit automaticamente.
18. Dados e contagens do inventário de preservação continuam consistentes após cada migration.

## 14. Critérios de liberação por etapa

Cada Sprint só avança quando:

- `npm test`, `npm run typecheck` e `npm run build` passam;
- migrations são validadas em banco vazio e em cópia com dados existentes;
- consultas de invariantes não apresentam perda ou duplicação;
- RLS multiempresa é testada com pelo menos dois perfis/empresas;
- Event Bus, Timeline e auditoria registram as ações relevantes;
- arquivos alterados e evidências de teste são reportados;
- a homologação utiliza exatamente o commit candidato;
- não há alteração direta em `main` nem promoção para produção sem aceite.

## 15. Próxima ação recomendada

Iniciar somente a **Sprint 0 — Preservação e baseline canônico**. Ela não muda a experiência do usuário, mas remove o risco de perder dados ou publicar uma evolução sobre ambientes divergentes.

Depois da evidência de backup/restauração e da reconciliação das migrations, iniciar a Sprint 1 em mudanças pequenas e testáveis. A refatoração visual de Orçamentos deve começar apenas quando o novo agregado transacional estiver disponível no servidor.

## 16. Referências de segurança para o hardening

- Supabase Database Linter — RLS habilitada sem policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Supabase Database Linter — funções `SECURITY DEFINER` executáveis: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Proteção de senha e senhas vazadas: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

