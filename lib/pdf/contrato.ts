import PDFDocument from 'pdfkit'

export async function gerarContratoPDF(contrato: any) {
  const reserva = Array.isArray(contrato.reservas) ? contrato.reservas[0] : contrato.reservas
  const cliente = reserva?.clientes
  const kit = reserva?.kits

  const doc = new PDFDocument({ margin: 50 })
  const chunks: Buffer[] = []

  doc.on('data', chunk => chunks.push(chunk))

  doc.fontSize(18).text('CONTRATO DE LOCAÇÃO DE FESTAS E DECORAÇÕES', { align: 'center' })
  doc.moveDown()

  doc.fontSize(12).text(`Contrato nº: ${contrato.numero_contrato}`)
  doc.text(`Status: ${contrato.status || 'Gerado'}`)
  doc.moveDown()

  doc.fontSize(14).text('1. CONTRATANTE')
  doc.fontSize(11).text(`Nome: ${cliente?.nome || '-'}`)
  doc.text(`CPF/CNPJ: ${cliente?.cpf || '-'}`)
  doc.text(`WhatsApp: ${cliente?.whatsapp || '-'}`)
  doc.text(`Endereço: ${cliente?.endereco || '-'}`)
  doc.moveDown()

  doc.fontSize(14).text('2. CONTRATADA')
  doc.fontSize(11).text('Cintia Paula Festas e Decorações')
  doc.moveDown()

  doc.fontSize(14).text('3. EVENTO')
  doc.fontSize(11).text(`Data: ${reserva?.data_evento || '-'}`)
  doc.text(`Horário: ${reserva?.horario_evento || '-'}`)
  doc.text(`Endereço: ${reserva?.endereco_evento || '-'}`)
  doc.moveDown()

  doc.fontSize(14).text('4. KIT CONTRATADO')
  doc.fontSize(11).text(`Kit: ${kit?.nome || '-'}`)
  doc.text(`Código: ${kit?.codigo || '-'}`)
  doc.moveDown()

  doc.fontSize(14).text('5. VALORES')
  doc.fontSize(11).text(`Valor total: R$ ${Number(reserva?.valor_total || 0).toFixed(2)}`)
  doc.text(`Valor do sinal: R$ ${Number(reserva?.valor_sinal || 0).toFixed(2)}`)
  doc.moveDown()

  doc.fontSize(14).text('6. RESPONSABILIDADES')
  doc.fontSize(11).text(
    'A contratante deverá zelar pelos itens locados durante o evento, responsabilizando-se por danos, perdas ou extravios identificados na devolução.',
    { align: 'justify' }
  )
  doc.moveDown()

  doc.fontSize(14).text('7. CANCELAMENTO E REAGENDAMENTO')
  doc.fontSize(11).text(
    'As condições de cancelamento, reagendamento e devolução de valores seguirão as regras comerciais previamente acordadas entre as partes.',
    { align: 'justify' }
  )

  doc.moveDown(3)
  doc.text('____________________________________')
  doc.text('Contratante')
  doc.moveDown()
  doc.text('____________________________________')
  doc.text('Cintia Paula Festas e Decorações')

  doc.end()

  return await new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })
}
