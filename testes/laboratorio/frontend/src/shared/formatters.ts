export function currentYear(): number {
  return new Date().getFullYear()
}

export function monthName(month: number): string {
  return ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][month - 1] ?? String(month)
}

export function typeLabel(value: string): string {
  const labels: Record<string, string> = {
    fisico_quimica: 'FQ',
    microbiologica: 'MB',
    fisico_quimica_microbiologica: 'FQ + MB',
  }

  return labels[value] ?? value
}
