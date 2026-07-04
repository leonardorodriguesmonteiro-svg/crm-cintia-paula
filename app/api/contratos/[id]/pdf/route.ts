import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { gerarContratoPDF } from '@/lib/pdf/contrato'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data, error } = await supabase
    .from('contratos')
    .select('id,numero_contrato,status,created_at,reservas(*,clientes(*),kits(*))')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || 'Contrato não encontrado' },
      { status: 404 }
    )
  }

  const pdfBuffer = await gerarContratoPDF(data)

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${data.numero_contrato}.pdf"`
    }
  })
}
