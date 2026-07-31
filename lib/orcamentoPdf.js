const ROSA = [190, 24, 93]
const ROSA_CLARO = [253, 242, 248]
const ARDOSIA = [15, 23, 42]
const CINZA = [100, 116, 139]
const BORDA = [226, 232, 240]

function moeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })
}

function dataCurta(valor) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

function texto(valor) {
  return String(valor || '-').trim() || '-'
}

function nomeSeguro(valor) {
  return String(valor || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function numeroOrcamento(numero) {
  return `ORC-${String(numero).padStart(4, '0')}`
}

function desenharCabecalhoCompacto(doc, protocolo) {
  doc.setFillColor(...ROSA)
  doc.rect(0, 0, 210, 14, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CINTIA PAULA  |  FESTAS E DECORAÇÕES', 16, 9)
  doc.text(protocolo, 194, 9, { align: 'right' })
}

function desenharRodapes(doc, protocolo) {
  const totalPaginas = doc.getNumberOfPages()

  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina)
    doc.setDrawColor(...BORDA)
    doc.line(16, 282, 194, 282)
    doc.setTextColor(...CINZA)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(`Proposta ${protocolo} - gerada pelo ERP Cintia Paula`, 16, 287)
    doc.text(`Página ${pagina} de ${totalPaginas}`, 194, 287, { align: 'right' })
  }
}

function tituloSecao(doc, titulo, y) {
  doc.setTextColor(...ROSA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(titulo.toUpperCase(), 16, y)
  doc.setDrawColor(...ROSA)
  doc.setLineWidth(0.6)
  doc.line(16, y + 2, 194, y + 2)
  return y + 8
}

function campo(doc, rotulo, valor, x, y, largura) {
  doc.setTextColor(...CINZA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text(rotulo.toUpperCase(), x, y)
  doc.setTextColor(...ARDOSIA)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const linhas = doc.splitTextToSize(texto(valor), largura)
  doc.text(linhas, x, y + 5)
}

/**
 * Cria o documento de proposta comercial.
 * @param {object} dados
 * @returns {Promise<{doc: import('jspdf').jsPDF, nomeArquivo: string}>}
 */
export async function criarDocumentoOrcamento(dados) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const protocolo = numeroOrcamento(dados.numero)
  const cliente = dados.cliente || {}
  const itens = dados.itens || []

  doc.setProperties({
    title: `Proposta comercial ${protocolo}`,
    subject: 'Orçamento para festa e decoração',
    author: 'Cintia Paula Festas e Decorações',
    creator: 'ERP Cintia Paula'
  })

  doc.setFillColor(...ROSA)
  doc.rect(0, 0, 210, 42, 'F')
  doc.setFillColor(255, 255, 255)
  doc.circle(25, 20, 10, 'F')
  doc.setTextColor(...ROSA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('CP', 25, 24, { align: 'center' })

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('CINTIA PAULA', 40, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Festas e Decorações', 40, 24)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('PROPOSTA COMERCIAL', 194, 16, { align: 'right' })
  doc.setFontSize(9)
  doc.text(protocolo, 194, 23, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Válida até ${dataCurta(dados.validade)}`, 194, 30, { align: 'right' })

  doc.setFillColor(...ROSA_CLARO)
  doc.roundedRect(16, 50, 178, 28, 3, 3, 'F')
  campo(doc, 'Cliente', cliente.nome, 21, 58, 74)
  campo(doc, 'WhatsApp', cliente.whatsapp, 105, 58, 38)
  campo(doc, 'E-mail', cliente.email, 151, 58, 38)

  let y = tituloSecao(doc, 'Informações do evento', 88)
  campo(doc, 'Data', dataCurta(dados.data_evento), 16, y, 35)
  campo(doc, 'Horário', dados.horario_evento, 57, y, 32)
  campo(doc, 'Retirada', dataCurta(dados.data_retirada), 95, y, 35)
  campo(doc, 'Devolução', dataCurta(dados.data_devolucao), 136, y, 35)
  y += 18
  campo(doc, 'Local do evento', dados.endereco_evento, 16, y, 174)
  y += 19

  const cabecalhoItens = () => {
    doc.setFillColor(...ARDOSIA)
    doc.roundedRect(16, y, 178, 9, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('ITEM / DESCRIÇÃO', 20, y + 6)
    doc.text('QTD.', 126, y + 6, { align: 'right' })
    doc.text('UNITÁRIO', 158, y + 6, { align: 'right' })
    doc.text('SUBTOTAL', 190, y + 6, { align: 'right' })
    y += 10
  }

  y = tituloSecao(doc, 'Itens da proposta', y)
  cabecalhoItens()

  itens.forEach((item, indice) => {
    const descricao = doc.splitTextToSize(texto(item.descricao), 94)
    const altura = Math.max(9, descricao.length * 4 + 4)

    if (y + altura > 248) {
      doc.addPage()
      desenharCabecalhoCompacto(doc, protocolo)
      y = 22
      cabecalhoItens()
    }

    if (indice % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(16, y, 178, altura, 'F')
    }

    doc.setTextColor(...ARDOSIA)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(descricao, 20, y + 5)
    doc.text(Number(item.quantidade || 0).toLocaleString('pt-BR'), 126, y + 5, { align: 'right' })
    doc.text(moeda(item.valor_unitario), 158, y + 5, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.text(moeda(item.subtotal), 190, y + 5, { align: 'right' })
    doc.setDrawColor(...BORDA)
    doc.line(16, y + altura, 194, y + altura)
    y += altura
  })

  if (y + 58 > 262) {
    doc.addPage()
    desenharCabecalhoCompacto(doc, protocolo)
    y = 24
  } else {
    y += 8
  }

  const resumoY = y
  doc.setFillColor(...ROSA_CLARO)
  doc.roundedRect(112, resumoY, 82, 45, 3, 3, 'F')
  doc.setTextColor(...ARDOSIA)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Subtotal', 118, resumoY + 8)
  doc.text(moeda(dados.subtotal), 188, resumoY + 8, { align: 'right' })
  doc.text('Desconto', 118, resumoY + 15)
  doc.text(`- ${moeda(dados.desconto)}`, 188, resumoY + 15, { align: 'right' })
  doc.text('Acréscimos', 118, resumoY + 22)
  doc.text(moeda(dados.acrescimos), 188, resumoY + 22, { align: 'right' })
  doc.text('Frete / entrega', 118, resumoY + 29)
  doc.text(moeda(dados.frete), 188, resumoY + 29, { align: 'right' })
  doc.setDrawColor(...ROSA)
  doc.line(118, resumoY + 33, 188, resumoY + 33)
  doc.setTextColor(...ROSA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL', 118, resumoY + 41)
  doc.text(moeda(dados.total), 188, resumoY + 41, { align: 'right' })

  doc.setTextColor(...ARDOSIA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('OBSERVAÇÕES', 16, resumoY + 3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const observacoes = doc.splitTextToSize(texto(dados.observacoes), 86)
  doc.text(observacoes.slice(0, 9), 16, resumoY + 10)

  y = resumoY + 55
  const observacoesRestantes = observacoes.slice(9)

  if (observacoesRestantes.length) {
    doc.addPage()
    desenharCabecalhoCompacto(doc, protocolo)
    y = tituloSecao(doc, 'Continuação das observações', 24)
    doc.setTextColor(...ARDOSIA)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    observacoesRestantes.forEach(linha => {
      if (y > 272) {
        doc.addPage()
        desenharCabecalhoCompacto(doc, protocolo)
        y = tituloSecao(doc, 'Continuação das observações', 24)
        doc.setTextColor(...ARDOSIA)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
      }

      doc.text(linha, 16, y)
      y += 4
    })

    y += 8
  }

  if (y + 26 > 278) {
    doc.addPage()
    desenharCabecalhoCompacto(doc, protocolo)
    y = 24
  }

  doc.setFillColor(...ARDOSIA)
  doc.roundedRect(16, y, 178, 24, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('PRÓXIMO PASSO', 22, y + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('A aprovação desta proposta confirma os valores. A reserva depende da disponibilidade', 22, y + 14)
  doc.text('do kit no período e será efetivada pelo atendimento da Cintia Paula.', 22, y + 19)

  desenharRodapes(doc, protocolo)

  return {
    doc,
    nomeArquivo: `${protocolo.toLowerCase()}-${nomeSeguro(cliente.nome)}.pdf`
  }
}

export function mensagemWhatsAppOrcamento(dados) {
  const cliente = dados.cliente || {}
  const primeiroNome = texto(cliente.nome).split(' ')[0]
  const protocolo = numeroOrcamento(dados.numero)

  const mensagem = [
    `Olá, ${primeiroNome}!`,
    '',
    `Preparamos o orçamento ${protocolo} para o seu evento em ${dataCurta(dados.data_evento)}.`,
    `Valor total: ${moeda(dados.total)}.`,
    `Validade da proposta: ${dataCurta(dados.validade)}.`,
    '',
    'O PDF com todos os itens acompanha esta mensagem.',
  ]

  if (dados.link_publico) {
    mensagem.push('', 'Você também pode visualizar e responder a proposta pelo link:', dados.link_publico)
  }

  mensagem.push('', 'Cintia Paula - Festas e Decorações')
  return mensagem.join('\n')
}

export function telefoneWhatsApp(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (!digitos) return ''
  return digitos.startsWith('55') ? digitos : `55${digitos}`
}
