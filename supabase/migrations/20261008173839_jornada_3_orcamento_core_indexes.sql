-- Índices de apoio às chaves estrangeiras introduzidas no Orçamento 3.0.
-- Separados da migration principal para preservar o histórico já homologado.

create index if not exists itens_conceituais_created_by_idx
  on public.itens_conceituais (created_by)
  where created_by is not null;

create index if not exists itens_conceituais_incorporado_por_idx
  on public.itens_conceituais (incorporado_por)
  where incorporado_por is not null;

create index if not exists orcamento_taxas_created_by_idx
  on public.orcamento_taxas (created_by)
  where created_by is not null;
