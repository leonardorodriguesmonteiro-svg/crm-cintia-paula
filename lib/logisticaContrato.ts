export const ENDERECO_RETIRADA = 'Rua Francisco Eugênio, 268 - Sala 948 - Imperial de São Cristovão, Rio de Janeiro - RJ - CEP 20941-120'
export type LogisticaContrato = {
  modalidade: string; tipo_local_evento: string; endereco_evento: string;
  data_retirada: string; horario_retirada: string; data_devolucao: string; horario_devolucao: string;
  endereco_retirada?: string; endereco_devolucao?: string
}
export const logisticaVazia: LogisticaContrato = { modalidade: '', tipo_local_evento: '', endereco_evento: '', data_retirada: '', horario_retirada: '', data_devolucao: '', horario_devolucao: '' }
export const horariosAtendimento = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']
export function dataBrasil(agora = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora) }
export function somarDias(data: string, dias: number) { const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+dias); return d.toISOString().slice(0,10) }
function pascoa(ano: number) {
  const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451)
  const mes=Math.floor((h+l-7*m+114)/31),dia=(h+l-7*m+114)%31+1
  return `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
}
// Política comercial: fechamento integral também nos pontos facultativos.
// Calendário federal MGI 11.460/2025 e RJ 50.252/2026, 50.525/2026.
// Atualizar exceções anuais quando forem publicados novos decretos.
export function diaAtendimento(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const d=new Date(`${data}T12:00:00Z`)
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==data || [0,6].includes(d.getUTCDay())) return false
  const ano=d.getUTCFullYear(), md=data.slice(5)
  if (['01-01','01-20','04-21','04-23','05-01','09-07','10-12','11-02','11-15','11-20','12-24','12-25','12-31'].includes(md)) return false
  if (md === (ano===2026 ? '10-30' : '10-28')) return false
  if (ano===2026 && ['04-20','04-24','06-05'].includes(md)) return false
  return ![-48,-47,-46,-2,60].some(offset=>somarDias(pascoa(ano),offset)===data)
}
export function proximoDiaAtendimento(data: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(new Date(`${data}T12:00:00Z`).getTime())) return ''
  let proximo=somarDias(data,1)
  for(let i=0;i<40;i++,proximo=somarDias(proximo,1)) if(diaAtendimento(proximo))return proximo
  return ''
}
export function modalidadeDoPedido(interesse: string | null | undefined) {
  return /(?:^|\|)\s*Modalidade:\s*Retirada(?:\s*\||\s*$)/i.test(interesse || '') ? 'Retirada' : /(?:^|\|)\s*Modalidade:\s*Entrega(?:\s*\||\s*$)/i.test(interesse || '') ? 'Entrega' : ''
}
