# Resultado dos invariantes — 07/10/2026

Consultas executadas diretamente nos projetos Supabase com o arquivo
`002_invariants_readonly.sql`. Nenhum dado ou objeto de schema foi alterado.

## Resultado executivo

**Aprovado.**

- nenhum item de orçamento órfão;
- nenhum item de oportunidade órfão;
- nenhuma reserva apontando para cliente ou kit inexistente;
- nenhum contrato apontando para reserva inexistente;
- nenhum conflito de empresa entre orçamento e oportunidade;
- nenhum CPF repetido entre os registros preenchidos;
- RLS habilitada em todas as tabelas públicas dos dois ambientes.

## Produção

Captura UTC: `2026-10-07T18:46:57.466136`

| Verificação | Resultado |
|---|---:|
| Tabelas públicas / com RLS | 53 / 53 |
| Clientes | 15 |
| Kits | 53 |
| Itens de estoque | 63 |
| Reservas | 9 |
| Contratos | 4 |
| Orçamentos / itens | 4 / 14 |
| Oportunidades / itens | 6 / 12 |
| Logs de auditoria | 1.189 |
| Usuários Auth | 2 |
| Objetos no Storage | 112 |
| Kits com foto | 51 |
| Itens de estoque com foto | 60 |

Storage: `catalogo-fotos` com 111 objetos e `logos-empresa` com 1 objeto.

Estados encontrados:

- oportunidades: `RECEBIDA` 2, `EM_ANALISE` 1, `APROVADA` 2,
  `CONVERTIDA_EM_PROPOSTA` 1;
- orçamentos: `RASCUNHO` 3, `ACEITA` 1;
- reservas: `Pendente` 1, `Confirmada` 1, `Concluída` 5, `Cancelada` 2;
- contratos: `Gerado` 2, `Enviado` 1, `Assinado` 1.

## Homologação

Captura UTC: `2026-10-07T18:47:02.187012`

| Verificação | Resultado |
|---|---:|
| Tabelas públicas / com RLS | 46 / 46 |
| Clientes | 1 |
| Kits | 1 |
| Itens de estoque | 1 |
| Reservas | 1 |
| Contratos | 1 |
| Orçamentos / itens | 1 / 1 |
| Oportunidades / itens | 2 / 2 |
| Logs de auditoria | 48 |
| Usuários Auth | 2 |
| Objetos no Storage | 2 |
| Kits com foto | 1 |
| Itens de estoque com foto | 1 |

Storage: `catalogo-fotos` com 2 objetos.

Estados encontrados:

- oportunidades: `RECEBIDA` 1, `CONVERTIDA_EM_PROPOSTA` 1;
- orçamentos: `ACEITA` 1;
- reservas: `Confirmada` 1;
- contratos: `Assinado` 1.

## Observação multiempresa

O modelo legado ainda não possui `empresa_id` em `clientes`, `reservas` e
`contratos`. Isso impede uma verificação relacional completa por empresa nessas
entidades. A ausência foi classificada como dívida estrutural para uma migration
aditiva da Sprint 1; nenhuma coluna será inserida ou preenchida sem regra de
backfill e RLS previamente testada.
