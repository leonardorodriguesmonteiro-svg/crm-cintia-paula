import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const cabecalhosPublicos = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cabecalhosPublicos })
}

export async function GET() {
  const [kitsRes, estoqueRes] = await Promise.all([
    supabaseServer
      .from('kits')
      .select(`
        id,codigo,nome,tema,categoria,quantidade,valor,status,foto_url,descricao,
        kit_composicao(
          quantidade,
          estoque_itens(id,codigo,nome,categoria,cor,status,foto_url,quantidade_disponivel)
        )
      `)
      .or('status.is.null,status.neq.Inativo')
      .order('nome'),
    supabaseServer
      .from('estoque_itens')
      .select('id,codigo,nome,categoria,cor,status,foto_url,quantidade_disponivel')
      .or('status.is.null,status.neq.Inativo')
      .order('nome')
  ])

  const erro = kitsRes.error || estoqueRes.error
  if (erro) {
    return NextResponse.json(
      { erro: 'Não foi possível carregar o catálogo.' },
      { status: 500, headers: cabecalhosPublicos }
    )
  }

  const kits = (kitsRes.data || []).map(kit => ({
    id: kit.id,
    codigo: kit.codigo,
    nome: kit.nome,
    tema: kit.tema,
    categoria: kit.categoria,
    descricao: kit.descricao,
    preco: Number(kit.valor || 0),
    status: kit.status,
    disponivel: kit.status === 'Disponível' && Number(kit.quantidade || 0) > 0,
    foto_url: kit.foto_url,
    composicao: (kit.kit_composicao || []).map(item => {
      const estoque = Array.isArray(item.estoque_itens)
        ? item.estoque_itens[0]
        : item.estoque_itens

      return {
        quantidade: Number(item.quantidade || 0),
        item: estoque ? {
          id: estoque.id,
          codigo: estoque.codigo,
          nome: estoque.nome,
          categoria: estoque.categoria,
          cor: estoque.cor,
          foto_url: estoque.foto_url,
          disponivel: estoque.status === 'Disponível' && Number(estoque.quantidade_disponivel || 0) > 0
        } : null
      }
    }).filter(item => item.item)
  }))

  const estoque = (estoqueRes.data || []).map(item => ({
    id: item.id,
    codigo: item.codigo,
    nome: item.nome,
    categoria: item.categoria,
    cor: item.cor,
    status: item.status,
    foto_url: item.foto_url,
    disponivel: item.status === 'Disponível' && Number(item.quantidade_disponivel || 0) > 0
  }))

  return NextResponse.json(
    {
      versao: 1,
      atualizado_em: new Date().toISOString(),
      kits,
      estoque
    },
    { headers: cabecalhosPublicos }
  )
}
