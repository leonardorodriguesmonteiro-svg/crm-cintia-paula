# Local do evento e agendamento do contrato

O cadastro público exige endereço completo do evento e tipo de espaço (salão de festas ou residência). Na modalidade Retirada, o cliente escolhe data e horário; o servidor calcula a devolução no primeiro dia de atendimento estritamente posterior ao evento. Os horários disponíveis são intervalos de 30 minutos, 09:00–12:00 e 14:00–18:00, fuso America/Sao_Paulo. O endereço de retirada/devolução é fixado no servidor conforme informado pela empresa.

Por decisão do usuário em 22/10/2026, pontos facultativos também fecham o atendimento durante o dia inteiro. O calendário inclui feriados nacionais, São Sebastião, São Jorge, Carnaval, segunda-feira de Carnaval, Quarta-feira de Cinzas, Corpus Christi e vésperas de Natal/Ano Novo. Em 2026 inclui as pontes 20/04, 24/04 e 05/06, e usa 30/10 para o Dia do Servidor no Rio (em vez de 28/10).

Referências consultadas:
- https://agenciagov.ebc.com.br/noticias/202512/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026
- https://www.rj.gov.br/gesperj/sites/default/files/Boletim%20GESPERJ%20-%20ABRIL%202026.pdf
- https://www.tjrj.jus.br/web/portal-conhecimento/noticias/noticia/-/visualizar-conteudo/5736540/406979295

As exceções de cada ano devem ser atualizadas em `lib/logisticaContrato.ts` e na função SQL `dia_atendimento_empresa` quando novos decretos forem publicados. Não há promessa de descoberta automática de feriados futuros. O teste PostgreSQL compara 730 datas entre interface e servidor.

A logística é copiada para orçamento/reserva e congelada no snapshot do contrato. Revisões posteriores preservam o histórico e o pagamento, invalidam a versão anterior e exigem nova liberação. Contratos já emitidos não recebem endereços presumidos. Reservas antigas sem esses dados podem ser completadas em Editar reserva antes de uma nova emissão.

Validação: 66 testes da aplicação, typecheck e build aprovados; calendário executado em PGlite; migração completa compilada em réplica local do esquema de homologação (sem dados pessoais); testes transacionais de cadastro, reserva, contrato, assinatura, pagamento e revisão aprovados localmente e em homologação, com rollback integral. Prévia do modelo real conferida com dados fictícios. Nenhuma mensagem, assinatura ou pagamento real foi gerado pelos testes.
