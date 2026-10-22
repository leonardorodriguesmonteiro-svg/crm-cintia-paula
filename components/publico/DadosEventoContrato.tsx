'use client'
import { ENDERECO_RETIRADA, dataBrasil, diaAtendimento, horariosAtendimento, proximoDiaAtendimento, type LogisticaContrato } from '@/lib/logisticaContrato'

export function DadosEventoContrato({ dataEvento, valor, onChange, modalidadeFixa = '', permitirDatasPassadas = false }: { dataEvento: string; valor: LogisticaContrato; onChange: (valor: LogisticaContrato) => void; modalidadeFixa?: string; permitirDatasPassadas?: boolean }) {
  const modalidade = modalidadeFixa || valor.modalidade
  const devolucao = proximoDiaAtendimento(dataEvento)
  const mudar = (campo: keyof LogisticaContrato, texto: string) => onChange({ ...valor, modalidade, [campo]: texto, data_devolucao: devolucao })
  const input = 'mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base font-normal text-slate-900'
  return <fieldset className="space-y-4 rounded-xl border border-pink-200 p-4 sm:col-span-2">
    <legend className="px-2 font-bold text-slate-900">Local da festa e agendamento</legend>
    <p className="text-sm text-slate-600">Informe o endereço onde a festa acontecerá, mesmo que seja diferente do endereço do contratante.</p>
    <label className="block text-sm font-semibold">Tipo de local do evento *<select required className={input} value={valor.tipo_local_evento} onChange={e=>mudar('tipo_local_evento',e.target.value)}><option value="">Selecione…</option><option>Salão de festas</option><option>Residência</option></select></label>
    <label className="block text-sm font-semibold">Endereço completo do local do evento *<textarea required minLength={10} maxLength={600} className={input} placeholder="Rua, número, complemento, bairro, cidade, UF e CEP" value={valor.endereco_evento} onChange={e=>mudar('endereco_evento',e.target.value)} /></label>
    {modalidadeFixa ? <p className="text-sm"><strong>Modalidade:</strong> {modalidadeFixa}</p> : <label className="block text-sm font-semibold">Modalidade *<select required className={input} value={modalidade} onChange={e=>mudar('modalidade',e.target.value)}><option value="">Selecione…</option><option>Retirada</option><option>Entrega</option></select></label>}
    {modalidade === 'Retirada' && <>
      <p className="rounded-lg bg-pink-50 p-3 text-sm"><strong>Retirada e devolução na empresa:</strong><br />{ENDERECO_RETIRADA}</p>
      <p className="text-sm text-slate-600">Segunda a sexta-feira, das 09:00 às 12:00 e das 14:00 às 18:00 (horário de Brasília), exceto feriados e pontos facultativos. Selecione um dos horários de 30 em 30 minutos.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">Data de retirada *<input type="date" required min={permitirDatasPassadas ? undefined : dataBrasil()} max={dataEvento} className={input} value={valor.data_retirada} onChange={e=>{ e.target.setCustomValidity(e.target.value && !diaAtendimento(e.target.value) ? 'Escolha um dia de atendimento, sem feriado ou ponto facultativo.' : ''); mudar('data_retirada',e.target.value) }} /></label>
        <label className="block text-sm font-semibold">Horário de retirada *<select required className={input} value={valor.horario_retirada} onChange={e=>mudar('horario_retirada',e.target.value)}><option value="">Selecione…</option>{horariosAtendimento.map(h=><option key={h}>{h}</option>)}</select></label>
        <label className="block text-sm font-semibold">Data de devolução<input type="date" readOnly className={input} value={devolucao} /></label>
        <label className="block text-sm font-semibold">Horário de devolução *<select required className={input} value={valor.horario_devolucao} onChange={e=>mudar('horario_devolucao',e.target.value)}><option value="">Selecione…</option>{horariosAtendimento.map(h=><option key={h}>{h}</option>)}</select></label>
      </div>
      <p className="text-sm text-slate-600">A devolução fica agendada para o primeiro dia de atendimento após a data do evento.</p>
    </>}
  </fieldset>
}
