export const PRODUCTION_WORKFLOWS = [
  { id: 'ordens', shortLabel: 'OP', label: 'Ordem de produção' },
  { id: 'queijo', shortLabel: 'Queijo', label: 'Formulação de queijo' },
  { id: 'soro', shortLabel: 'Soro', label: 'Soro refrigerado' },
  { id: 'formulacao-creme', shortLabel: 'Fórm. creme', label: 'Formulação de creme' },
  { id: 'producao-creme', shortLabel: 'Prod. creme', label: 'Produção de creme' },
] as const

export type WorkflowId = (typeof PRODUCTION_WORKFLOWS)[number]['id']
export type View = 'inicio' | WorkflowId
