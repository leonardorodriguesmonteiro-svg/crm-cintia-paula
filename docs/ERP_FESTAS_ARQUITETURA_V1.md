# ERP FESTAS — Arquitetura Oficial v1.0

## 1. Visão Geral

O ERP Festas é uma plataforma vertical para empresas de locação, decoração e operação de festas e eventos.

A primeira implantação do ERP é o CRM Cíntia Paula.

## 2. Objetivo do Produto

Centralizar em um único sistema:

- clientes;
- reservas;
- kits;
- estoque;
- financeiro;
- contratos;
- checklist;
- logística;
- ordem de serviço;
- workflow;
- dashboard executivo;
- auditoria operacional.

## 3. Princípio Central

Nenhuma informação deve ser digitada duas vezes.

A reserva é o centro do processo e alimenta automaticamente financeiro, jurídico, operação, logística, checklist e dashboard.

## 4. Módulos Principais

### Comercial
- Clientes
- Reservas
- Orçamentos
- Agenda
- Histórico

### Financeiro
- Valor contratado
- Recebimentos
- Saldo
- Pendências
- Fluxo de caixa futuro

### Operação
- Centro Operacional
- Ordem de Serviço
- Checklist
- Logística
- Separação
- Entrega
- Devolução

### Jurídico
- Contratos
- Biblioteca de cláusulas
- Modelos jurídicos
- Versões
- Auditoria
- Assinaturas futuras

### Estoque
- Itens
- Kits
- Composição
- Disponibilidade
- Manutenção

### Workflow Engine
- Estados da reserva
- Eventos
- Regras
- Ações automáticas
- Logs

## 5. Workflow Engine

O Workflow Engine será responsável por transformar a reserva em um processo automatizado.

Exemplo:

Reserva confirmada
→ cria contrato
→ cria ordem de serviço
→ cria checklist
→ registra timeline
→ atualiza dashboard

## 6. Estados da Reserva

### Status Comercial
- Lead
- Orçamento
- Reserva
- Confirmada
- Cancelada
- Finalizada

### Status Operacional
- Aguardando operação
- Separação
- Entrega
- Montagem
- Evento
- Retirada
- Conferência
- Encerrada

## 7. Eventos do Workflow

Exemplos:

- reserva criada;
- reserva confirmada;
- pagamento registrado;
- contrato gerado;
- contrato assinado;
- OS criada;
- checklist concluído;
- entrega realizada;
- devolução concluída.

## 8. Ações Automáticas

Exemplos:

- criar contrato;
- criar OS;
- criar checklist;
- criar logística;
- registrar timeline;
- atualizar status;
- futuramente enviar WhatsApp/e-mail.

## 9. Centro Operacional

O Centro Operacional será a área responsável por coordenar a execução da reserva.

Deverá exibir:

- Ordem de Serviço;
- progresso operacional;
- tarefas;
- responsáveis;
- prazos;
- alertas;
- pendências;
- timeline operacional.

## 10. Centro Jurídico

O Jurídico será uma camada transversal do ERP.

Ele deverá controlar:

- contratos;
- cláusulas;
- versões;
- aditivos;
- ocorrências;
- danos;
- ressarcimentos;
- auditoria.

## 11. Dashboard Executivo

O Dashboard Executivo deverá consolidar indicadores de:

- comercial;
- financeiro;
- operação;
- estoque;
- jurídico.

## 12. Roadmap Técnico

### Fase 1 — Workflow Engine
- Estados da reserva
- Eventos
- Regras automáticas
- Ações automáticas

### Fase 2 — Centro Operacional 2.0
- Painel do dia
- Alertas
- Prioridades
- Equipe

### Fase 3 — Assinatura Eletrônica
- Assinatura do contrato
- Histórico
- Auditoria

### Fase 4 — Dashboard Executivo
- Indicadores comerciais
- Indicadores financeiros
- Indicadores operacionais

### Fase 5 — Centro Jurídico
- Contratos avançados
- Ocorrências
- Aditivos
- Ressarcimentos

## 13. Diretriz Final

O ERP deve ser desenvolvido por módulos de negócio, não por telas isoladas.

Cada módulo deve seguir:

1. Arquitetura
2. Banco de Dados
3. Regras de Negócio
4. Interface
5. Automações
