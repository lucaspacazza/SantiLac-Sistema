import type { PasteurizadorResumo } from '../api/dashboardResumoTypes'

export type DashboardView = 'inicio' | 'resumo-diario'

export function parseView(): DashboardView {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return hash === 'dashboard/inicio' ? 'inicio' : 'resumo-diario'
}

export function parseData(): string {
  const query = window.location.hash.split('?')[1] ?? ''
  return new URLSearchParams(query).get('data') ?? ''
}

export function openHash(hash: string) {
  window.location.hash = hash
}

export function openResumoDiario(data: string) {
  window.location.hash = `#/dashboard/resumo-diario?data=${encodeURIComponent(data)}`
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
