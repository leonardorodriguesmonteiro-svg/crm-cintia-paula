import { supabaseServer } from '@/lib/supabaseServer'
import { PrintContractButton } from '@/components/PrintContractButton'
import { clausulasLocacaoContrato, declaracaoAceiteContrato, termosGeraisContrato } from '@/lib/contratoTermos'
import { formatarEnderecoCompleto } from '@/lib/endereco'

export const dynamic = 'force-dynamic'

function mascararDocumento(valor: string | null) {
  const digitos = String(valor || '').replace(/\D/g, '')
  return digitos.length >= 4 ? `•••• ${digitos.slice(-4)}` : '-'
}

function dataCurta(valor: string | null | undefined) {
  if (!valor) return '-'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: contrato } = await supabaseServer
    .from('contratos')
    .select('id,numero_contrato,status,reserva_id,created_at,assinado_em,assinado_por,assinatura_documento,assinatura_aceite')
    .eq('id', id)
    .maybeSingle()

  if (!contrato) return <main style={{ padding: 40 }}>Contrato não encontrado.</main>

  const { data: reserva } = await supabaseServer.from('reservas').select('*').eq('id', contrato.reserva_id).maybeSingle()
  const { data: cliente } = await supabaseServer.from('clientes').select('*').eq('id', reserva?.cliente_id).maybeSingle()
  const { data: kit } = await supabaseServer.from('kits').select('*').eq('id', reserva?.kit_id).maybeSingle()
  const { data: itens } = await supabaseServer
    .from('reserva_itens')
    .select('id,descricao,quantidade,valor_unitario,subtotal,kit_id')
    .eq('reserva_id', contrato.reserva_id)
    .order('ordem', { ascending: true })
  const { data: empresa } = await supabaseServer
    .from('empresas')
    .select('nome,nome_fantasia,razao_social,cnpj,email,telefone,whatsapp,site,logradouro,numero,complemento,bairro,cidade,estado,logo_url,contrato_padrao')
    .limit(1)
    .maybeSingle()
  const nomeEmpresa = empresa?.nome_fantasia || empresa?.nome || 'Cintia Paula'
  const termosEmpresa = empresa?.contrato_padrao
    ?.split(/\n\s*\n/)
    .map(item => item.trim())
    .filter(Boolean) || termosGeraisContrato

  const box = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  }

  return (
    <main style={{ background: '#f8fafc', padding: 32, fontFamily: 'Arial, sans-serif', color: '#111827' }}>
      <PrintContractButton />
      <section style={{ maxWidth: 820, margin: '0 auto', background: '#fff', padding: 40, borderRadius: 18 }}>
        <header style={{ borderBottom: '3px solid #db2777', paddingBottom: 18, marginBottom: 24 }}>
          {empresa?.logo_url && <img src={empresa.logo_url} alt={`Logo ${nomeEmpresa}`} style={{ maxWidth: 110, maxHeight: 72, objectFit: 'contain', marginBottom: 12 }} />}
          <h1 style={{ margin: 0, color: '#be185d', fontSize: 28 }}>{nomeEmpresa}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b' }}>Festas e Decorações</p>
          <h2 style={{ textAlign: 'center', marginTop: 24 }}>CONTRATO DE LOCAÇÃO</h2>
          <p style={{ textAlign: 'center' }}><strong>Nº {contrato.numero_contrato}</strong></p>
        </header>

        <div style={box}>
          <h3>1. Contratante</h3>
          <p><strong>Nome:</strong> {cliente?.nome || '-'}</p>
          <p><strong>CPF/CNPJ:</strong> {cliente?.cpf || '-'}</p>
          <p><strong>RG:</strong> {cliente?.rg || '-'}</p>
          <p><strong>WhatsApp:</strong> {cliente?.whatsapp || '-'}</p>
          <p><strong>E-mail:</strong> {cliente?.email || '-'}</p>
          <p><strong>Endereço:</strong> {formatarEnderecoCompleto([cliente?.endereco, cliente?.numero, cliente?.complemento, cliente?.bairro, cliente?.cidade, cliente?.estado], cliente?.cep) || '-'}</p>
        </div>

        <div style={box}>
          <h3>2. Evento</h3>
          <p><strong>Data:</strong> {dataCurta(reserva?.data_evento)}</p>
          <p><strong>Horário:</strong> {reserva?.horario_evento || '-'}</p>
          <p><strong>Endereço:</strong> {reserva?.endereco_evento || '-'}</p>
        </div>

        <div style={box}>
          <h3>3. Itens contratados</h3>
          {(itens || []).map(item => <p key={item.id}><strong>{Number(item.quantidade || 0)} × {item.descricao}</strong> — R$ {Number(item.subtotal || 0).toFixed(2)}</p>)}
          {!itens?.length && <p><strong>Kit:</strong> {kit?.nome || '-'} ({kit?.codigo || 'sem código'})</p>}
        </div>

        <div style={box}>
          <h3>4. Valores</h3>
          <p><strong>Valor total:</strong> R$ {Number(reserva?.valor_total || 0).toFixed(2)}</p>
          <p><strong>Sinal:</strong> R$ {Number(reserva?.valor_sinal || 0).toFixed(2)}</p>
        </div>

        <div style={box}>
          <h3>5. Termos e condições</h3>
          <ol>{termosEmpresa.map(termo => <li key={termo} style={{ marginBottom: 8 }}>{termo}</li>)}</ol>
        </div>

        <div style={box}>
          <h3>6. Cláusulas para locação</h3>
          <ol>{clausulasLocacaoContrato.map(clausula => <li key={clausula.titulo} style={{ marginBottom: 8 }}><strong>{clausula.titulo}:</strong> {clausula.texto}</li>)}</ol>
          <p><strong>{declaracaoAceiteContrato}</strong></p>
        </div>

        <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          <div>
            <p>____________________________________</p>
            <p>Contratante</p>
          </div>
          <div>
            <p>____________________________________</p>
            <p>{nomeEmpresa}</p>
          </div>
        </div>

        {contrato.status === 'Assinado' && contrato.assinado_em && (
          <div style={{ ...box, marginTop: 32, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
            <h3 style={{ color: '#166534' }}>Certificado de aceite eletrônico</h3>
            <p><strong>Assinado por:</strong> {contrato.assinado_por || cliente?.nome || '-'}</p>
            <p><strong>Documento final:</strong> {mascararDocumento(contrato.assinatura_documento)}</p>
            <p><strong>Data e hora:</strong> {new Date(contrato.assinado_em).toLocaleString('pt-BR')}</p>
            <p><strong>Registro:</strong> {contrato.assinatura_aceite ? 'Aceite eletrônico registrado pelo cliente.' : 'Assinatura confirmada internamente pela equipe.'}</p>
          </div>
        )}

        <footer style={{ marginTop: 40, borderTop: '1px solid #e5e7eb', paddingTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
          Documento gerado pelo CRM Cintia Paula
        </footer>
      </section>
    </main>
  )
}
