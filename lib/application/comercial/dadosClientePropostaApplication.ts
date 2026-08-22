import { ERPEvents } from '@/lib/events/catalog'
import { publicarEvento } from '@/lib/events/eventBus'
import { supabaseServer } from '@/lib/supabaseServer'
import { JornadaComercialError } from './jornadaComercialApplication'

const ufs = new Set([
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
])

function cpfValido(cpfInformado: string) {
  const cpf = cpfInformado.replace(/\D/g, '')
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false

  const digito = (tamanho: number) => {
    let soma = 0
    for (let indice = 0; indice < tamanho; indice += 1) {
      soma += Number(cpf[indice]) * (tamanho + 1 - indice)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10])
}

export type CompletarDadosClientePropostaV2Input = {
  token: string
  cpf: string
  cep: string
  endereco: string
  numero: string
  complemento?: string | null
  bairro: string
  cidade: string
  estado: string
  email?: string | null
}

export async function completarDadosClientePropostaV2(
  input: CompletarDadosClientePropostaV2Input
) {
  const cpf = input.cpf.replace(/\D/g, '')
  const cep = input.cep.replace(/\D/g, '')
  const endereco = input.endereco.trim()
  const numero = input.numero.trim()
  const complemento = input.complemento?.trim() || null
  const bairro = input.bairro.trim()
  const cidade = input.cidade.trim()
  const estado = input.estado.trim().toUpperCase()
  const email = input.email?.trim().toLowerCase() || null

  if (!cpfValido(cpf)) {
    throw new JornadaComercialError('Informe um CPF válido.', 'CPF_INVALIDO')
  }

  if (!/^\d{8}$/.test(cep)) {
    throw new JornadaComercialError('Informe um CEP válido com 8 números.', 'CEP_INVALIDO')
  }

  if (endereco.length < 2 || endereco.length > 300) {
    throw new JornadaComercialError('Informe o logradouro corretamente.', 'ENDERECO_INVALIDO')
  }

  if (numero.length < 1 || numero.length > 30) {
    throw new JornadaComercialError('Informe o número do endereço.', 'NUMERO_INVALIDO')
  }

  if (complemento && complemento.length > 120) {
    throw new JornadaComercialError('O complemento é muito longo.', 'COMPLEMENTO_INVALIDO')
  }

  if (bairro.length < 2 || bairro.length > 120) {
    throw new JornadaComercialError('Informe o bairro corretamente.', 'BAIRRO_INVALIDO')
  }

  if (cidade.length < 2 || cidade.length > 120) {
    throw new JornadaComercialError('Informe a cidade corretamente.', 'CIDADE_INVALIDA')
  }

  if (!ufs.has(estado)) {
    throw new JornadaComercialError('Informe uma UF válida.', 'ESTADO_INVALIDO')
  }

  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new JornadaComercialError('Informe um e-mail válido.', 'EMAIL_INVALIDO')
  }

  const { data, error } = await supabaseServer.rpc(
    'completar_dados_cliente_proposta_v2_servidor',
    {
      p_token: input.token,
      p_cpf: cpf,
      p_cep: cep,
      p_endereco: endereco,
      p_numero: numero,
      p_complemento: complemento,
      p_bairro: bairro,
      p_cidade: cidade,
      p_estado: estado,
      p_email: email
    }
  )

  if (error) throw error

  const resultado = data as {
    orcamento_id: string
    empresa_id: string | null
    oportunidade_id: string | null
    numero: number
    status: string
    ja_completo: boolean
  }

  if (!resultado.ja_completo) {
    await publicarEvento({
      codigo: ERPEvents.CLIENTE_DADOS_COMPLETOS,
      titulo: `Dados cadastrais da proposta #${resultado.numero} concluídos`,
      descricao: 'Cliente concluiu CPF e endereço completo necessários para o contrato.',
      empresaId: resultado.empresa_id,
      entidadeTipo: 'Proposta',
      entidadeId: resultado.orcamento_id,
      modulo: 'Comercial',
      origem: 'Site',
      status: resultado.status,
      metadados: { numero: resultado.numero }
    })
  }

  return resultado
}
