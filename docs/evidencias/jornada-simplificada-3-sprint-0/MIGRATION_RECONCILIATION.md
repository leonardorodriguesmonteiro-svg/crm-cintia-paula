# Reconciliação do histórico de migrations

## Resultado

**Reconciliado por baseline, sem alteração do histórico remoto.**

A fotografia ao vivo de 07/10/2026 confirmou três linhas históricas diferentes:

| Origem | Registros/arquivos | Maior versão |
|---|---:|---|
| Produção `pxhgfyvpzbcjymmnoyuo` | 24 migrations remotas | `20260929172540` |
| Homologação `iwcdrexhwiuycfdbitnw` | 70 migrations remotas | `20260925031236` |
| Repositório | 64 arquivos SQL | `20260925031147` |

Os schemas também continuam diferentes:

| Ambiente | Assinatura | Tabelas públicas | Funções públicas | Triggers públicas |
|---|---|---:|---:|---:|
| Produção | `102370ee22516164384bfdf5a5424123` | 53 | 76 | 66 |
| Homologação | `8d598db0df124557b7c0cd84445c30ff` | 46 | 73 | 64 |

Produção possui sete tabelas legadas que homologação não possui: `estoque`,
`pagamentos`, `site_pre_reservas`, `temas`, `workflow_acoes`,
`workflow_eventos` e `workflow_regras`. Homologação não possui tabela pública
exclusiva. As três funções e duas triggers exclusivas de produção também são
legadas.

## Classificação do histórico

### 1. Fundação histórica local

Os arquivos de `20260627_001_base.sql` até
`20260814_038_ocorrencias_missao.sql` são **históricos/consolidados**. Eles foram
usados na instalação limpa de homologação e seus objetos estão materializados
em produção, mas não correspondem individualmente ao histórico remoto de
produção. Não devem ser reaplicados em nenhum dos dois projetos.

### 2. Esteira comercial V2

As 17 migrations remotas originais de produção estão preservadas em
`docs/evidencias/migracoes-producao-2026-08-24`. A comparação com os arquivos
locais de nome equivalente encontrou SQL byte a byte idêntico apenas em:

- `acoes_proposta`;
- `finalizador_exclusivo_v2`;
- `hardening_rpc_disponibilidade`.

As demais versões locais são **variantes históricas ou substituídas**. Para
explicar o estado de produção, prevalecem os SQLs exportados do remoto e o dump
validado de 07/10/2026.

### 3. Promoção e ajustes posteriores de produção

Produção registra ainda:

- `promover_esteira_comercial_consolidada_20260824`;
- `acompanhamento_links_privados`;
- `cadastro_antes_orcamento`;
- `cadastro_cnpj_acompanhamento`;
- `pre_reserva_valores_desconto`;
- `sincronizar_total_pre_reserva`;
- `ajustar_autorizacao_desconto_pre_reserva`.

Os quatro últimos possuem arquivos locais semanticamente correspondentes, mas
timestamp igual não será presumido e equivalência por nome não será tratada
como equivalência de conteúdo.

### 4. Histórico exclusivo de homologação

Homologação contém a instalação limpa, imports prefixados por `prod_` e ajustes
experimentais próprios. Eles explicam o schema do ambiente de teste, mas não
são a linha canônica de produção e não serão promovidos automaticamente.

## Decisão canônica

1. O dump validado de produção e sua assinatura são a referência de
   preservação.
2. Os 64 arquivos atuais ficam congelados como histórico; nenhum será editado,
   renomeado ou reaplicado.
3. Não será executado `supabase db push` enquanto o diretório histórico estiver
   divergente do remoto.
4. `supabase migration repair` não será usado para declarar SQL diferente como
   aplicado. A documentação oficial confirma que esse comando altera apenas o
   rastreamento, não o schema.
5. A Jornada 3.0 começa com migrations novas, aditivas e posteriores a
   `20261007000000`, cada uma com SQL idempotente, invariantes e rollback por
   compatibilidade.
6. Cada migration será aplicada primeiro em homologação por operação
   controlada, registrada com nome semântico, e somente depois será candidata a
   produção.
7. A correspondência de versões remotas dos dois ambientes será mantida em um
   manifesto de release; igualdade de timestamp não será requisito para
   equivalência funcional.

Essa decisão evita dois riscos: reaplicar 64 migrations históricas sobre dados
reais e apagar/forjar 70 registros válidos da homologação.

O schema legado ainda não possui `empresa_id` em `clientes`, `reservas` e
`contratos`. A Sprint 1 deverá tratar o isolamento dessas entidades de forma
aditiva; o portão atual valida o vínculo multiempresa já materializado entre
`orcamentos` e `oportunidades`.

## Portão antes de cada migration nova

1. confirmar backup e hashes;
2. executar `002_invariants_readonly.sql` nos dois ambientes;
3. salvar o resultado de homologação antes da alteração;
4. aplicar uma única migration em homologação;
5. executar advisors, invariantes e testes;
6. validar o frontend no mesmo commit;
7. produzir evidência e plano de rollback;
8. somente então solicitar promoção para produção.

## Proibições mantidas

- não executar `supabase db reset` nos projetos remotos;
- não reaplicar a pasta histórica;
- não editar `supabase_migrations.schema_migrations` manualmente;
- não usar `DROP`, `TRUNCATE` ou exclusões para igualar ambientes;
- não desativar RLS;
- não copiar credenciais de produção para homologação.

Referências oficiais:

- https://supabase.com/docs/guides/deployment/database-migrations
- https://supabase.com/docs/reference/cli/supabase-migration-repair
