import { NextRequest, NextResponse } from 'next/server'
import {
  exigirPerfis,
  respostaErroAdministrativo
} from '@/lib/server/adminAuth'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AcaoFormalizacao =
  | 'formalizar'
  | 'confirmar_assinatura'
  | 'confirmar_sinal'

export async function POST(
  request: NextRequest,
  contexto: { params: Promise<{ id: string }> }
) {
  try {
    const corpo = await request.json() as {
      acao?: AcaoFormalizacao
      valor_sinal?: number
      vencimento?: string
      forma_pagamento?: string
    }
    const acao = corpo.acao

    if (!acao || !['formalizar', 'confirmar_assinatura', 'confirmar_sinal'].includes(acao)) {
      return NextResponse.json({ error: 'Ação de formalização inválida.' }, { status: 400 })
    }

    const acesso = await exigirPerfis(
      request,
      acao === 'confirmar_sinal' ? ['Comercial', 'Financeiro'] : ['Comercial']
    )

    const { id } = await contexto.params
    if (acao === 'formalizar') {
      const valorSinal = Number(corpo.valor_sinal || 0)
      if (valorSinal <= 0 || !corpo.vencimento) {
        return NextResponse.json(
          { error: 'Informe o valor e o vencimento do sinal.' },
          { status: 400 }
        )
      }

    }

    const resultado = await supabaseServer.rpc('executar_formalizacao_servidor', {
      p_usuario_id: acesso.usuario.id,
      p_orcamento_id: id,
      p_acao: acao,
      p_valor_sinal: acao === 'formalizar' ? Number(corpo.valor_sinal || 0) : null,
      p_vencimento: acao === 'formalizar' ? corpo.vencimento : null,
      p_forma_pagamento: acao === 'confirmar_sinal' ? corpo.forma_pagamento || 'Pix' : null
    })

    if (resultado.error) {
      return NextResponse.json({ error: resultado.error.message }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true, ...(resultado.data || {}) })
  } catch (error) {
    const resposta = respostaErroAdministrativo(error)
    return NextResponse.json({ error: resposta.mensagem }, { status: resposta.status })
  }
}
