import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { gerarContratoPDF } from '@/lib/pdf/contrato'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    let { data: contrato, error: contratoError } = await supabase
      .from('contratos')
      .select('id,numero_contrato,status,created_at,reserva_id')
      .eq('id', id)
      .limit(1)
      .maybeSingle()

    if (!contrato) {
      const fallback = await supabase
        .from('contratos')
        .select('id,numero_contrato,status,created_at,reserva_id')
        .eq('reserva_id', id)
        .limit(1)
        .maybeSingle()

      contrato = fallback.data
      contratoError = fallback.error
    }

    if (contratoError || !contrato) {
      return NextResponse.json(
        { error: contratoError?.message || 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', contrato.reserva_id)
      .single()

    if (reservaError || !reserva) {
      return NextResponse.json(
        { error: reservaError?.message || 'Reserva não encontrada' },
        { status: 404 }
      )
    }

    const { data: cliente } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', reserva.cliente_id)
      .maybeSingle()

    const { data: kit } = await supabase
      .from('kits')
      .select('*')
      .eq('id', reserva.kit_id)
      .maybeSingle()

    const contratoCompleto = {
      ...contrato,
      reservas: {
        ...reserva,
        clientes: cliente,
        kits: kit
      }
    }

    const pdfBuffer = await gerarContratoPDF(contratoCompleto)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${contrato.numero_contrato}.pdf"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao gerar PDF' },
      { status: 500 }
    )
  }
}
