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
    slug: 'qualidade',
    title: 'Qualidade',
    desc: 'Análises e qualidade.',
    levels: ['2.5'],
    icon: 'fa-flask',
    href: '#/inicio',
    children: [
      { title: 'Visão geral', icon: 'fa-home', href: '#/inicio' },
      { title: 'Produtores', icon: 'fa-users', href: '#/produtores' },
      { title: 'Análises', icon: 'fa-flask', href: '#/analises' },
      { title: 'Relatórios', icon: 'fa-chart-pie', href: '#/relatorios' },
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
      { title: 'Visão geral', icon: 'fa-home', href: '#/estoque/inicio' },
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
      { title: 'Visão geral', icon: 'fa-home', href: '#/combustivel/inicio' },
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
      { title: 'Visão geral', icon: 'fa-home', href: '#/pasteurizador/inicio' },
      { title: 'Histórico', icon: 'fa-clipboard-list', href: '#/pasteurizador/historico' },
    ],
  },
] as const satisfies readonly SidebarModule[]

export type SystemModule = typeof sidebarModules[number]['slug']

export function isSystemModule(value: string): value is SystemModule {
  return sidebarModules.some((module) => module.slug === value)
}

export function moduleHref(slug: SystemModule): string {
  return sidebarModules.find((module) => module.slug === slug)?.href ?? '#/sistema'
}
