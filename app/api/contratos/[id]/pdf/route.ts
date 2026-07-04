import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const porId = await supabase
    .from('contratos')
    .select('id,numero_contrato,status,created_at,reserva_id')
    .eq('id', id)

  const porReserva = await supabase
    .from('contratos')
    .select('id,numero_contrato,status,created_at,reserva_id')
    .eq('reserva_id', id)

  return NextResponse.json({
    id_recebido: id,
    busca_por_id: porId,
    busca_por_reserva_id: porReserva
  })
}
