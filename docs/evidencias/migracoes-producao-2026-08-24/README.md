# Migrações exportadas da produção — 24/08/2026

Estes 17 arquivos foram obtidos pela API oficial de leitura do Supabase para o
projeto `pxhgfyvpzbcjymmnoyuo`. Eles preservam o histórico efetivamente
registrado em `supabase_migrations.schema_migrations`.

## Uso seguro

- Estes arquivos são evidência para comparação; não são uma fila de implantação.
- A pasta fica fora de `supabase/migrations` intencionalmente, evitando que a CLI
  tente reaplicar SQL já executado em produção.
- Não mover, renomear ou aplicar estes arquivos sem concluir a reconciliação.
- Nenhuma chave secreta literal foi encontrada no conteúdo exportado.

## Comparação com arquivos locais de nome equivalente

| Migração remota | Arquivo local | Resultado SHA-256 |
| --- | --- | --- |
| `esteira_comercial_v2_base` | `20260814_039` | diferente |
| `pre_reserva_aplicacao` | `20260814_040` | diferente |
| `pre_reserva_rate_limit` | `20260814_041` | diferente |
| `aceite_e_dados_cliente` | `20260814_042` | diferente |
| `acoes_proposta` | `20260814_043` | idêntico |
| `feedback_central_v2` | `20260821_039` | diferente |

O resultado confirma que nomes semelhantes não podem ser tratados como a mesma
migração sem análise de conteúdo.
