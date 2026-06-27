import type { PasteurizadorResumo } from '../api/dashboardResumoTypes'

export type DashboardView = 'overview' | 'operations' | 'risks'

export function parseView(): DashboardView {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  if (hash === 'dashboard/operacao') return 'operations'
  if (hash === 'dashboard/riscos') return 'risks'
  return 'overview'
}

export function parseData(): string {
  const query = window.location.hash.split('?')[1] ?? ''
  return new URLSearchParams(query).get('data') ?? ''
}

export function openHash(hash: string) {
  window.location.hash = hash
}

export function openDashboardView(view: DashboardView, data: string) {
  const path = view === 'operations' ? 'operacao' : view === 'risks' ? 'riscos' : 'visao-geral'
  window.location.hash = `#/dashboard/${path}?data=${encodeURIComponent(data)}`
}

export function openResumoDiario(data: string) {
  openDashboardView('operations', data)
}

export function pasteurizadorHash(pasteurizador: PasteurizadorResumo): string {
  const params = new URLSearchParams({
    inicio: pasteurizador.filtro.inicio,
    fim: pasteurizador.filtro.fim,
    hora_inicio: pasteurizador.filtro.hora_inicio,
    hora_fim: pasteurizador.filtro.hora_fim,
    canal: pasteurizador.filtro.canal,
  })

  return `#/pasteurizador/historico?${params.toString()}`
}
