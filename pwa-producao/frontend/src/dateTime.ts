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

export function parseTimeValue(value: string, fallback = new Date()): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim())
  const hour = match ? Number(match[1]) : Number.NaN
  const minute = match ? Number(match[2]) : Number.NaN

  if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59) {
    return { hour, minute }
  }

  return { hour: fallback.getHours(), minute: fallback.getMinutes() }
}
