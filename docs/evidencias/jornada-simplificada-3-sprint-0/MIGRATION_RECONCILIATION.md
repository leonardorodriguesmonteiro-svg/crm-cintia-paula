# Reconciliação do histórico de migrations

## Decisão

O schema remoto em produção será a referência funcional para preservação. O histórico local não será reaplicado. A Jornada 3.0 começará com novas migrations aditivas, posteriores a um baseline documentado.

## Procedimento

1. gerar dump de roles, schema e dados de produção;
2. restaurar o dump em banco isolado;
3. comparar o schema restaurado com `database.types.production.ts` e com a assinatura de baseline;
4. classificar cada migration local como aplicada, equivalente, substituída ou apenas histórica;
5. documentar os objetos exclusivos de produção e homologação;
6. criar uma migration de baseline somente se necessária para instalações novas;
7. iniciar a numeração da Jornada 3.0 depois do maior timestamp remoto;
8. aplicar cada nova migration primeiro em homologação;
9. executar advisors, invariantes e testes após cada aplicação.

## Proibições

- não executar `supabase db reset` nos projetos remotos;
- não executar `supabase db push` antes da reconciliação;
- não editar registros da migration history manualmente;
- não usar `DROP`, `TRUNCATE` ou exclusões para “igualar” ambientes;
- não desativar RLS;
- não copiar credenciais de produção para Preview/Homologação.

## Resultado esperado

Uma linha de migrations da Jornada 3.0 que seja aditiva, repetível, testável e independente das divergências históricas.
