import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: contrato } = await supabaseServer
    .from('contratos')
    .select('id,numero_contrato,status,reserva_id,created_at')
    .eq('id', id)
    .maybeSingle()

  if (!contrato) return <main style={{ padding: 40 }}>Contrato não encontrado.</main>

  const { data: reserva } = await supabaseServer.from('reservas').select('*').eq('id', contrato.reserva_id).maybeSingle()
  const { data: cliente } = await supabaseServer.from('clientes').select('*').eq('id', reserva?.cliente_id).maybeSingle()
  const { data: kit } = await supabaseServer.from('kits').select('*').eq('id', reserva?.kit_id).maybeSingle()

  const box = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  }

  return (
    <main style={{ background: '#f8fafc', padding: 32, fontFamily: 'Arial, sans-serif', color: '#111827' }}>
      <section style={{ maxWidth: 820, margin: '0 auto', background: '#fff', padding: 40, borderRadius: 18 }}>
        <header style={{ borderBottom: '3px solid #db2777', paddingBottom: 18, marginBottom: 24 }}>
          <h1 style={{ margin: 0, color: '#be185d', fontSize: 28 }}>Cintia Paula</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Festas e Decorações</p>
          <h2 style={{ textAlign: 'center', marginTop: 24 }}>CONTRATO DE LOCAÇÃO</h2>
          <p style={{ textAlign: 'center' }}><strong>Nº {contrato.numero_contrato}</strong></p>
        </header>

        <div style={box}>
          <h3>1. Contratante</h3>
          <p><strong>Nome:</strong> {cliente?.nome || '-'}</p>
          <p><strong>CPF/CNPJ:</strong> {cliente?.cpf || '-'}</p>
          <p><strong>WhatsApp:</strong> {cliente?.whatsapp || '-'}</p>
          <p><strong>Endereço:</strong> {cliente?.endereco || '-'}</p>
        </div>

        <div style={box}>
          <h3>2. Evento</h3>
          <p><strong>Data:</strong> {reserva?.data_evento || '-'}</p>
          <p><strong>Horário:</strong> {reserva?.horario_evento || '-'}</p>
          <p><strong>Endereço:</strong> {reserva?.endereco_evento || '-'}</p>
        </div>

        <div style={box}>
          <h3>3. Kit contratado</h3>
          <p><strong>Kit:</strong> {kit?.nome || '-'}</p>
          <p><strong>Código:</strong> {kit?.codigo || '-'}</p>
        </div>

        <div style={box}>
          <h3>4. Valores</h3>
          <p><strong>Valor total:</strong> R$ {Number(reserva?.valor_total || 0).toFixed(2)}</p>
          <p><strong>Sinal:</strong> R$ {Number(reserva?.valor_sinal || 0).toFixed(2)}</p>
        </div>

        <div style={box}>
          <h3>5. Responsabilidades</h3>
          <p>
            A contratante deverá zelar pelos itens locados durante o período do evento,
            responsabilizando-se por danos, perdas ou extravios identificados na devolução.
          </p>
        </div>

        <div style={box}>
          <h3>6. Cancelamento e reagendamento</h3>
          <p>
            As condições de cancelamento, reagendamento e devolução de valores seguirão
            as regras comerciais previamente acordadas entre as partes.
          </p>
        </div>

        <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          <div>
            <p>____________________________________</p>
            <p>Contratante</p>
          </div>
          <div>
            <p>____________________________________</p>
            <p>Cintia Paula Festas e Decorações</p>
          </div>
        </div>

        <footer style={{ marginTop: 40, borderTop: '1px solid #e5e7eb', paddingTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          Documento gerado pelo CRM Cintia Paula
        </footer>
      </section>
    </main>
  )
}
