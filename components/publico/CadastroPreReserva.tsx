'use client'
import { useState } from 'react'
const campos = [
  ['cpf', 'CPF ou CNPJ', 'text', 18, 'off'], ['email', 'E-mail para receber o orçamento', 'email', 254, 'email'],
  ['cep', 'CEP', 'text', 9, 'postal-code'], ['endereco', 'Logradouro', 'text', 300, 'address-line1'],
  ['numero', 'Número', 'text', 30, 'off'], ['complemento', 'Complemento (opcional)', 'text', 120, 'address-line2'],
  ['bairro', 'Bairro', 'text', 120, 'off'], ['cidade', 'Cidade', 'text', 120, 'address-level2'],
  ['estado', 'UF', 'text', 2, 'address-level1']
] as const
export function CadastroPreReserva({ onConcluido }: { onConcluido: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [concluido, setConcluido] = useState(false)
  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando) return
    const dados = Object.fromEntries(new FormData(event.currentTarget))
    setEnviando(true); setErro('')
    try {
      const resposta = await fetch('/api/publico/acompanhamento/cadastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dados, token: window.location.hash.slice(1) }) })
      const corpo = await resposta.json()
      if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível salvar.')
      setConcluido(true); onConcluido()
    } catch (error) { setErro(error instanceof Error ? error.message : 'Falha de conexão. Tente novamente.') }
    finally { setEnviando(false) }
  }
  if (concluido) return <p role="status" className="rounded-2xl bg-white p-6">Cadastro recebido! A equipe preparará seu orçamento final.</p>
  return <section className="rounded-2xl border border-pink-200 bg-white p-6">
    <h2 className="text-xl font-bold">Pré-reserva aprovada! Complete seu cadastro</h2>
    <p className="mt-2 text-slate-600">Precisamos destes dados para preparar seu orçamento e os documentos da contratação. Você receberá o orçamento final por e-mail para conferir e aceitar.</p>
    <form onSubmit={salvar} className="mt-5 grid gap-4 sm:grid-cols-2">
      {campos.map(([name, label, type, maxLength, autoComplete]) => <label key={name} className="block text-sm font-semibold">{label}<input name={name} type={type} maxLength={maxLength} autoComplete={autoComplete} inputMode={name === 'cpf' || name === 'cep' ? 'numeric' : undefined} required={name !== 'complemento'} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-base font-normal" /></label>)}
      {erro && <p role="alert" className="text-red-700 sm:col-span-2">{erro}</p>}
      <button type="submit" disabled={enviando} className="rounded-xl bg-pink-600 px-5 py-3 font-bold text-white disabled:opacity-60 sm:col-span-2">{enviando ? 'Enviando cadastro…' : 'Concluir cadastro para o orçamento'}</button>
    </form>
  </section>
}
