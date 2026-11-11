export const TIME_ZONE = 'America/Sao_Paulo'

type WallClock = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function wallClock(date: Date): WallClock {
  const map: Record<string, string> = {}
  for (const part of partFormat.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  let year = Number(map.year)
  let month = Number(map.month)
  let day = Number(map.day)
  let hour = Number(map.hour)
  const minute = Number(map.minute)
  const second = Number(map.second)
  if (hour === 24) {
    hour = 0
    const next = new Date(Date.UTC(year, month - 1, day) + 86_400_000)
    year = next.getUTCFullYear()
    month = next.getUTCMonth() + 1
    day = next.getUTCDate()
  }
  return { year, month, day, hour, minute, second }
}

function offsetMs(utcMs: number): number {
  const parts = wallClock(new Date(utcMs))
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - utcMs
}

/** Wall-clock time in São Paulo as a UTC timestamp. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second)
  let utc = guess - offsetMs(guess)
  utc = guess - offsetMs(utc)
  return utc
}

export function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function dayKey(ms: number): string {
  const parts = wallClock(new Date(ms))
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function monthKey(ms: number): string {
  const parts = wallClock(new Date(ms))
  return `${parts.year}-${pad(parts.month)}`
}

export function dayBounds(key: string): { start: number; end: number } {
  const [year, month, day] = key.split('-').map(Number)
  return {
    start: zonedToUtc(year, month, day, 0, 0, 0),
    end: zonedToUtc(year, month, day + 1, 0, 0, 0),
  }
}

export function monthBounds(ms: number): { start: number; end: number; key: string } {
  const parts = wallClock(new Date(ms))
  const key = `${parts.year}-${pad(parts.month)}`
  const start = zonedToUtc(parts.year, parts.month, 1, 0, 0, 0)
  const end = zonedToUtc(parts.year, parts.month + 1, 1, 0, 0, 0)
  return { start, end, key }
}

export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ms)
}

export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(ms)
}

export function formatMonth(ms: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(ms)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatDay(ms: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(ms)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function formatWhen(ms: number, nowMs: number): string {
  const time = formatTime(ms)
  if (dayKey(ms) === dayKey(nowMs)) return time
  const yesterday = dayKey(dayBounds(dayKey(nowMs)).start - 1000)
  if (dayKey(ms) === yesterday) return `ontem às ${time}`
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'short',
  }).format(ms)
  return `${date} às ${time}`
}
