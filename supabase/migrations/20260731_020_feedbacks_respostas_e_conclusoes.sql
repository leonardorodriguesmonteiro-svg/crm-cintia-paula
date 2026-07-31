-- Confirmação automática para novos feedbacks e conclusão dos relatos já
-- solucionados pela versão publicada em 31/07/2026.

alter table public.feedbacks
alter column resposta set default
  'Recebemos seu feedback e ele já foi registrado para análise. Você pode acompanhar o andamento por esta Central.';

update public.feedbacks
set
  resposta = 'Padronizamos o campo de celular no formato 21 99999-9999. O celular com DDD agora é obrigatório e o CPF passou a ser opcional.',
  status = 'Concluído',
  prioridade = 'Média',
  resolvido_em = now(),
  updated_at = now()
where mensagem ilike '%Padronizar o cadastro do celular%';

update public.feedbacks
set
  resposta = 'Identificamos os campos ao lado de Categoria. Eles agora exibem os rótulos “Quantidade disponível” e “Valor da locação (R$)”, além de exemplos de preenchimento.',
  status = 'Concluído',
  prioridade = 'Média',
  resolvido_em = now(),
  updated_at = now()
where mensagem ilike '%campos ao lado do campo categoria%';

update public.feedbacks
set
  resposta = 'O CPF deixou de ser obrigatório. Para manter um contato confiável no cadastro, o celular com DDD passou a ser obrigatório.',
  status = 'Concluído',
  prioridade = 'Alta',
  resolvido_em = now(),
  updated_at = now()
where mensagem ilike '%CPF obrigatório%';

update public.feedbacks
set
  resposta = 'Os campos numéricos e de valores agora selecionam automaticamente o conteúdo atual ao receber foco. Assim, basta digitar o novo valor para substituir o zero.',
  status = 'Concluído',
  prioridade = 'Média',
  resolvido_em = now(),
  updated_at = now()
where mensagem ilike '%número 0%';

update public.feedbacks
set
  resposta = coalesce(
    nullif(resposta, ''),
    'Recebemos seu feedback e ele já foi registrado para análise. Você pode acompanhar o andamento por esta Central.'
  ),
  updated_at = now()
where resposta is null or resposta = '';
