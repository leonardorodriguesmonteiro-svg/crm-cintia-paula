import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: contrato } = await supabaseServer
    .from('contratos')
    .select('id,numero_contrato,status,reserva_id,created_at')
    .eq('id', id)
    .maybeSingle()

  if (!contrato) {
    return <main style={{ padding: 40 }}>Contrato não encontrado.</main>
  }

  const { data: reserva } = await supabaseServer
    .from('reservas')
    .select('*')
    .eq('id', contrato.reserva_id)
    .maybeSingle()

  const { data: cliente } = await supabaseServer
    .from('clientes')
    .select('*')
    .eq('id', reserva?.cliente_id)
    .maybeSingle()

  const { data: kit } = await supabaseServer
    .from('kits')
    .select('*')
    .eq('id', reserva?.kit_id)
    .maybeSingle()

  return (
    <main style={{ maxWidth: 820, margin: '40px auto', padding: 24, fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }}>
      <button
        onClick={() => print()}
        style={{ marginBottom: 24, padding: '10px 16px', borderRadius: 8, border: 0, background: '#db2777', color: '#fff', fontWeight: 700 }}
      >
        Imprimir / Salvar como PDF
      </button>

      <h1 style={{ textAlign: 'center' }}>CONTRATO DE LOCAÇÃO</h1>

      <p><strong>Contrato nº:</strong> {contrato.numero_contrato}</p>
      <p><strong>Status:</strong> {contrato.status}</p>

      <hr />

      <h2>1. Contratante</h2>
      <p><strong>Nome:</strong> {cliente?.nome || '-'}</p>
      <p><strong>CPF/CNPJ:</strong> {cliente?.cpf || '-'}</p>
      <p><strong>WhatsApp:</strong> {cliente?.whatsapp || '-'}</p>
      <p><strong>Endereço:</strong> {cliente?.endereco || '-'}</p>

      <h2>2. Contratada</h2>
      <p>Cintia Paula Festas e Decorações.</p>

      <h2>3. Evento</h2>
      <p><strong>Data:</strong> {reserva?.data_evento || '-'}</p>
      <p><strong>Horário:</strong> {reserva?.horario_evento || '-'}</p>
      <p><strong>Endereço:</strong> {reserva?.endereco_evento || '-'}</p>

      <h2>4. Kit contratado</h2>
      <p><strong>Kit:</strong> {kit?.nome || '-'}</p>
      <p><strong>Código:</strong> {kit?.codigo || '-'}</p>

      <h2>5. Valores</h2>
      <p><strong>Valor total:</strong> R$ {Number(reserva?.valor_total || 0).toFixed(2)}</p>
      <p><strong>Sinal:</strong> R$ {Number(reserva?.valor_sinal || 0).toFixed(2)}</p>

      <h2>6. Responsabilidades</h2>
      <p>
        A contratante deverá zelar pelos itens locados durante o período do evento,
        responsabilizando-se por danos, perdas ou extravios identificados na devolução.
      </p>

      <h2>7. Cancelamento e reagendamento</h2>
      <p>
        As condições de cancelamento, reagendamento e devolução de valores seguirão
        as regras comerciais previamente acordadas entre as partes.
      </p>

      <br /><br />

      <p>________________________________________</p>
      <p>Contratante</p>

      <br />

      <p>________________________________________</p>
      <p>Cintia Paula Festas e Decorações</p>
    </main>
  )
}
