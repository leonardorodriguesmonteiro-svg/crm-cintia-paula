export const PERFIS = [
  'Administrador',
  'Comercial',
  'Financeiro',
  'Operação',
  'Estoque'
] as const

export type PerfilUsuario = (typeof PERFIS)[number]

export type ModuloAcesso =
  | 'dashboard'
  | 'comercial'
  | 'orcamentos'
  | 'clientes'
  | 'reservas'
  | 'agenda'
  | 'contratos'
  | 'operacao'
  | 'equipe'
  | 'kits'
  | 'estoque'
  | 'financeiro'
  | 'feedbacks'
  | 'usuarios'
  | 'configuracoes'
  | 'auditoria'

export const PERMISSOES_POR_PERFIL: Record<PerfilUsuario, ModuloAcesso[]> = {
  Administrador: [
    'dashboard', 'comercial', 'orcamentos', 'clientes', 'reservas', 'agenda',
    'contratos', 'operacao', 'equipe', 'kits', 'estoque', 'financeiro',
    'feedbacks', 'usuarios', 'configuracoes', 'auditoria'
  ],
  Comercial: [
    'dashboard', 'comercial', 'orcamentos', 'clientes', 'reservas', 'agenda',
    'contratos'
  ],
  Financeiro: ['dashboard', 'clientes', 'reservas', 'contratos', 'financeiro'],
  Operação: ['dashboard', 'reservas', 'agenda', 'operacao', 'equipe', 'kits', 'estoque'],
  Estoque: ['dashboard', 'reservas', 'kits', 'estoque']
}

export type AcessoAtual = {
  usuario_id: string
  empresa_id: string
  empresa_nome: string
  nome: string
  perfil: PerfilUsuario
  ativo: boolean
  permissoes: ModuloAcesso[]
}

export function moduloDaRota(pathname: string): ModuloAcesso | null {
  if (pathname.startsWith('/administracao/usuarios')) return 'usuarios'
  if (pathname.startsWith('/administracao/auditoria')) return 'auditoria'
  if (pathname.startsWith('/administracao/feedbacks')) return 'feedbacks'
  if (pathname.startsWith('/configuracoes')) return 'configuracoes'
  if (pathname.startsWith('/financeiro')) return 'financeiro'
  if (pathname.startsWith('/kits') || pathname.startsWith('/estoque')) {
    return pathname.startsWith('/estoque') ? 'estoque' : 'kits'
  }
  if (pathname.startsWith('/operacao') || pathname.startsWith('/missoes')) return 'operacao'
  if (pathname.startsWith('/equipe')) return 'equipe'
  if (pathname.startsWith('/contratos')) return 'contratos'
  if (pathname.startsWith('/agenda')) return 'agenda'
  if (pathname.startsWith('/reservas')) return 'reservas'
  if (pathname.startsWith('/clientes')) return 'clientes'
  if (pathname.startsWith('/orcamentos')) return 'orcamentos'
  if (pathname.startsWith('/comercial')) return 'comercial'
  if (pathname.startsWith('/dashboard') || pathname === '/') return 'dashboard'
  return null
}

export function perfilValido(valor: unknown): valor is PerfilUsuario {
  return PERFIS.includes(valor as PerfilUsuario)
}
