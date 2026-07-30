export type SidebarModule = {
  slug: string
  title: string
  desc: string
  levels: string[]
  icon: string
  href: string
  children?: SidebarSubmodule[]
}

export type SidebarSubmodule = {
  title: string
  icon: string
  href: string
}

export const sidebarModules = [
  {
    slug: 'dashboard',
    title: 'Dashboard',
    desc: 'Leitura executiva e operacional da empresa.',
    levels: ['7.0'],
    icon: 'fa-chart-line',
    href: '#/dashboard',
    children: [],
  },
  {
    slug: 'qualidade',
    title: 'Qualidade',
    desc: 'Análises e qualidade.',
    levels: ['2.5'],
    icon: 'fa-flask',
    href: '#/inicio',
    children: [
      { title: 'Produtores', icon: 'fa-users', href: '#/produtores' },
      { title: 'Análises', icon: 'fa-flask', href: '#/analises' },
      { title: 'Relatórios', icon: 'fa-chart-pie', href: '#/relatorios' },
    ],
  },
  {
    slug: 'producao',
    title: 'Produção',
    desc: 'Fichas e ordens de produção.',
    levels: ['2.0'],
    icon: 'fa-cogs',
    href: '#/producao/inicio',
    children: [
      { title: 'Formulação queijo', icon: 'fa-clipboard-list', href: '#/producao/listagem-formulacoes-queijo' },
      { title: 'Ordem de produção', icon: 'fa-list-check', href: '#/producao/ordem-producao' },
      { title: 'Soro refrigerado', icon: 'fa-droplet', href: '#/producao/listagem-soro-refrigerado' },
      { title: 'Formulação creme', icon: 'fa-clipboard-list', href: '#/producao/listagem-formulacoes-creme' },
      { title: 'Produção creme', icon: 'fa-industry', href: '#/producao/listagem-producoes-creme' },
    ],
  },
  {
    slug: 'estoque',
    title: 'Estoque',
    desc: 'Controle de insumos.',
    levels: ['2.1'],
    icon: 'fa-warehouse',
    href: '#/estoque/inicio',
    children: [
      { title: 'Itens', icon: 'fa-warehouse', href: '#/estoque/itens' },
      { title: 'Movimentações', icon: 'fa-exchange-alt', href: '#/estoque/movimentos' },
    ],
  },
  {
    slug: 'combustivel',
    title: 'Combustível',
    desc: 'Estoque do tanque e abastecimentos.',
    levels: ['3.4'],
    icon: 'fa-gas-pump',
    href: '#/combustivel/inicio',
    children: [
      { title: 'Entrada', icon: 'fa-arrow-down', href: '#/combustivel/entrada' },
      { title: 'Saída', icon: 'fa-arrow-up', href: '#/combustivel/saida' },
      { title: 'Histórico', icon: 'fa-clipboard-list', href: '#/combustivel/historico' },
    ],
  },
  {
    slug: 'pasteurizador',
    title: 'Pasteurizador',
    desc: 'Histórico de pasteurização.',
    levels: ['3.5'],
    icon: 'fa-thermometer-half',
    href: '#/pasteurizador/inicio',
    children: [
      { title: 'Histórico', icon: 'fa-clipboard-list', href: '#/pasteurizador/historico' },
    ],
  },
  {
    slug: 'coletas',
    title: 'Leite',
    desc: 'Rotas e coletas do app.',
    levels: ['3.6'],
    icon: 'fa-milk',
    href: '#/coletas/inicio',
    children: [
      { title: 'Rotas', icon: 'fa-route', href: '#/coletas/rotas' },
    ],
  },
  {
    slug: 'expedicao',
    title: 'Expedição',
    desc: 'Estoque final e carregamentos.',
    levels: ['3.7'],
    icon: 'fa-truck',
    href: '#/expedicao',
    children: [
      { title: 'Estoque', icon: 'fa-warehouse', href: '#/expedicao/estoque' },
      { title: 'Expedição', icon: 'fa-truck', href: '#/expedicao/ordens' },
      { title: 'Relatórios', icon: 'fa-chart-pie', href: '#/expedicao/relatorios' },
    ],
  },
  {
    slug: 'cadastros',
    title: 'Cadastros',
    desc: 'Usuários, produtores e motoristas.',
    levels: ['6.0'],
    icon: 'fa-users',
    href: '#/cadastros/usuarios',
    children: [
      { title: 'Usuários', icon: 'fa-users', href: '#/cadastros/usuarios' },
      { title: 'Produtores', icon: 'fa-user', href: '#/cadastros/produtores' },
      { title: 'Motoristas', icon: 'fa-id-card', href: '#/cadastros/motoristas' },
    ],
  },
] as const satisfies readonly SidebarModule[]

export type SystemModule = typeof sidebarModules[number]['slug']
export type SidebarModuleItem = typeof sidebarModules[number]

export function isSystemModule(value: string): value is SystemModule {
  return sidebarModules.some((module) => module.slug === value)
}

export function moduleHref(slug: SystemModule): string {
  return sidebarModules.find((module) => module.slug === slug)?.href ?? '#/sistema'
}

export type ModuleAccessUser = {
  niveis: string[]
  admin: boolean
}

export function canAccessModule(user: ModuleAccessUser | null | undefined, module: SidebarModule): boolean {
  if (!user) {
    return false
  }

  if (user.admin || user.niveis.includes('7.0')) {
    return true
  }

  return module.levels.some((level) => user.niveis.includes(level))
}

export function allowedSidebarModules(user: ModuleAccessUser | null | undefined) {
  return sidebarModules.filter((module) => canAccessModule(user, module))
}

export function canAccessModuleSlug(user: ModuleAccessUser | null | undefined, slug: SystemModule): boolean {
  const module = sidebarModules.find((item) => item.slug === slug)
  return module ? canAccessModule(user, module) : false
}
