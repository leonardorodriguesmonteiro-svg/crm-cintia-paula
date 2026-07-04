import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { gerarContratoPDF } from '@/lib/pdf/contrato'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: contrato, error } = await supabaseServer
      .from('contratos')
      .select('id,numero_contrato,status,created_at,reserva_id')
      .eq('id', id)
      .maybeSingle()

    if (error || !contrato) {
      return NextResponse.json({ error: error?.message || 'Contrato não encontrado' }, { status: 404 })
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

    const pdfBuffer = await gerarContratoPDF({
      ...contrato,
      reservas: { ...reserva, clientes: cliente, kits: kit }
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${contrato.numero_contrato}.pdf"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao gerar PDF' }, { status: 500 })
  }
}
