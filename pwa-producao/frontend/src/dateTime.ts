function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function localDateValue(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatTimeValue(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

export function localTimeValue(date = new Date()): string {
  return formatTimeValue(date.getHours(), date.getMinutes())
}

export function normalizeTimeValue(value: string): string {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(value.trim())
  if (!match) return ''

  const hour = Number(match[1])
  const minute = Number(match[2])
  const second = match[3] === undefined ? 0 : Number(match[3])

  if (
    !Number.isInteger(hour) || hour < 0 || hour > 23
    || !Number.isInteger(minute) || minute < 0 || minute > 59
    || !Number.isInteger(second) || second < 0 || second > 59
  ) {
    return ''
  }

  return formatTimeValue(hour, minute)
}

export function parseTimeValue(value: string, fallback = new Date()): { hour: number; minute: number } {
  const normalized = normalizeTimeValue(value)
  if (normalized) {
    const [hour, minute] = normalized.split(':').map(Number)
    return { hour, minute }
  }

  return { hour: fallback.getHours(), minute: fallback.getMinutes() }
}

export function wheelIndexFromScroll(scrollTop: number, itemHeight: number, valueCount: number): number {
  if (valueCount <= 0 || itemHeight <= 0) return 0
  const safeScrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0
  return Math.min(valueCount - 1, Math.round(safeScrollTop / itemHeight))
}
