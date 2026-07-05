# ERP FESTAS — Modelo de Domínio v1.0

## 1. Conceito Central

O ERP Festas será orientado por EVENTOS.

Um evento representa todo o ciclo comercial, financeiro, jurídico e operacional de uma locação ou decoração.

## 2. Entidade Principal

### Evento

O Evento é o centro do ERP.

Ele conecta:

- Cliente
- Reserva
- Kit
- Contrato
- Financeiro
- Ordem de Serviço
- Checklist
- Logística
- Timeline
- Ocorrências
- Assinaturas
- Dashboard

## 3. Entidades do Domínio

### Cliente
Pessoa física ou jurídica contratante.

### Reserva
Registro comercial da contratação.

### Kit
Conjunto de itens locados ou utilizados no evento.

### Contrato
Documento jurídico vinculado à reserva/evento.

### Recebimento
Registro financeiro de valores recebidos.

### Ordem de Serviço
Documento operacional que orienta a execução do evento.

### Checklist
Lista de conferência de separação, entrega e devolução.

### Logística
Controle de entrega, montagem, retirada e responsáveis.

### Timeline
Histórico completo de tudo que aconteceu no evento.

### Workflow
Motor de estados, eventos, regras e ações automáticas.

### Jurídico
Camada responsável por contratos, cláusulas, versões, aditivos e auditoria.

## 4. Regra Principal

Nenhuma informação deve ser digitada duas vezes.

Dados cadastrados na reserva alimentam automaticamente:

- contrato;
- financeiro;
- ordem de serviço;
- checklist;
- logística;
- timeline;
- dashboard.

## 5. Estados Comerciais

- Lead
- Orçamento
- Reserva
- Confirmada
- Cancelada
- Finalizada

## 6. Estados Operacionais

- Aguardando operação
- Separação
- Conferência
- Entrega
- Montagem
- Evento
- Retirada
- Devolução
- Encerrada

## 7. Eventos do Workflow

- Reserva criada
- Reserva confirmada
- Pagamento registrado
- Contrato gerado
- Contrato assinado
- OS criada
- Checklist iniciado
- Entrega realizada
- Retirada realizada
- Evento encerrado

## 8. Ações Automáticas

O Workflow poderá executar:

- criar contrato;
- criar OS;
- criar checklist;
- criar logística;
- registrar timeline;
- atualizar status comercial;
- atualizar status operacional;
- gerar alerta;
- atualizar dashboard.

## 9. Dono da Informação

### Cliente
Dono dos dados cadastrais.

### Reserva
Dona dos dados comerciais.

### Financeiro
Dono dos recebimentos e saldos.

### Jurídico
Dono dos contratos e versões.

### Operação
Dona da OS, checklist e logística.

### Workflow
Dono das transições, eventos e automações.

## 10. Próxima Evolução Técnica

Criar o Workflow Engine inicial com:

- função para registrar evento de workflow;
- função para criar ações automáticas;
- integração com timeline;
- criação automática de contrato e OS quando reserva for confirmada.

