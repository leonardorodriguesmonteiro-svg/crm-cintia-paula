# Jornada 3: contrato e pagamento após o aceite

A formalização aceita propostas diretas com itens livres/conceituais, além de kits e estoque. O contrato mantém quantidade e preço negociado, descontos separados por item, desconto global e taxas. A soma das linhas precisa coincidir com o total aceito; divergências revertem a transação. Itens conceituais são identificados no documento e não representam disponibilidade física.

A API e a função de formalização conferem a empresa do orçamento. Pedidos repetidos devolvem o contrato e o sinal existentes, preservando seus valores. O retorno mantém nova_confirmacao para que a aplicação publique o evento somente uma vez. A reserva é confirmada apenas depois da assinatura e do sinal, com revalidação do estoque físico.

A proposta aceita oferece um botão para abrir contrato e pagamento. O link exige contrato ativo vinculado à mesma reserva. A geração de preferência de pagamento também confere a empresa. A gravação do link de pagamento passa a ser exclusiva do servidor; os links enviados usam a origem oficial configurada.

## Verificação

- 48 testes unitários, TypeScript e build Next.js aprovados.
- PGlite com estrutura de tabelas e funções auxiliares reais: composição financeira, itens livres/conceituais, repetição de formalização, preservação do sinal, isolamento por empresa, rollback por total divergente e confirmação com assinatura/pagamento em ambas as ordens. A disponibilidade neste teste local é simulada.
- Homologação: testes transacionais completos com funções e triggers reais desde o editor, envio, aceite e cadastro até contrato, assinatura pública e conciliação simulada do pagamento; rollback integral.
- Cenário de estoque físico confirmou comprometimento apenas ao final; cenário conceitual não criou estoque.
- Nenhum e-mail, preferência ou pagamento real foi enviado/criado no provedor. A conciliação foi simulada dentro de transação revertida. Teste de navegação autenticada não realizado.
- Advisors de homologação: sem achados nas funções alteradas; permanecem avisos de funções legadas SECURITY DEFINER e proteção contra senhas vazadas desativada. Referências: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable e https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Limites preservados

Kits continuam limitados a uma unidade por linha e sem repetição do mesmo kit, conforme o modelo operacional existente. O sinal deve ser positivo e não superar o total. Aquisição/incorporação de itens conceituais ao estoque é uma etapa posterior; o contrato registra a necessidade, sem inventar disponibilidade.
