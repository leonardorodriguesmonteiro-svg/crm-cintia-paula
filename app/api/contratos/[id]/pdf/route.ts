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

    let { data, error } = await supabase
      .from('contratos')
      .select('id,numero_contrato,status,created_at,reservas(*,clientes(*),kits(*))')
      .eq('id', id)
      .limit(1)
      .maybeSingle()

    if (!data) {
      const fallback = await supabase
        .from('contratos')
        .select('id,numero_contrato,status,created_at,reservas(*,clientes(*),kits(*))')
        .eq('reserva_id', id)
        .limit(1)
        .maybeSingle()

      data = fallback.data
      error = fallback.error
    }

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Contrato não encontrado' },
        { status: 404 }
      )
    }

    const pdfBuffer = await gerarContratoPDF(data)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${data.numero_contrato}.pdf"`,
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
