import { supabase } from '@/lib/supabase'

export async function revisarReserva(id: string, dados: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sua sessão expirou. Entre novamente no CRM.')
  const resposta = await fetch(`/api/reservas/${id}/revisar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(dados)
  })
  const corpo = await resposta.json()
  if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível revisar a reserva.')
  return corpo as { mensagem: string }
}
