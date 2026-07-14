# ADR-001 — Arquitetura em Camadas

## Status

Aprovado.

## Decisão

O ERP Festas adotará a seguinte arquitetura:

Interface
→ Application
→ Domain Service
→ Repository
→ Supabase

## Responsabilidades

### Interface
Exibe dados e envia comandos. Não contém regras de negócio.

### Application
Orquestra os casos de uso do ERP.

### Domain Service
Aplica regras de negócio e aciona o Workflow Engine.

### Repository
É a única camada responsável pelo acesso ao banco de dados.

### Supabase
Armazena e protege os dados do ERP.

## Regra de evolução

A migração será gradual. Funcionalidades existentes continuarão funcionando enquanto o acesso direto ao Supabase é movido para repositories.
