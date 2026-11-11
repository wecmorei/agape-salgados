import { dayBounds, dayKey, formatDay, formatTime, monthBounds } from './time.ts'

export const SALARIO_MENSAL = 8500
export const CARGA_PADRAO = 220
export const CARGA_MIN = 1
export const CARGA_MAX = 744

export const PUNCH_KINDS = ['entrada', 'saida', 'intervalo_inicio', 'intervalo_fim'] as const
export type PunchKind = (typeof PUNCH_KINDS)[number]
export type ShiftState = 'fora' | 'trabalhando' | 'intervalo'

export type Punch = {
  id: string
  at: string
  kind: PunchKind
}

type BreakSpan = { start: number; end: number | null }
type Shift = { start: number; end: number | null; breaks: BreakSpan[] }
type Segment = { start: number; end: number }

export type DayRow = {
  key: string
  label: string
  events: { id: string; time: string; label: string }[]
  workedMs: number
  notes: string[]
  live: boolean
}

export type MonthSummary = {
  workedMs: number
  hours: number
  hourly: number
  amount: number
  carga: number
}

const KIND_LABEL: Record<PunchKind, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  intervalo_inicio: 'Início do intervalo',
  intervalo_fim: 'Fim do intervalo',
}

export function isPunchKind(value: unknown): value is PunchKind {
  return typeof value === 'string' && (PUNCH_KINDS as readonly string[]).includes(value)
}

export function isPunch(value: unknown): value is Punch {
  if (!value || typeof value !== 'object') return false
  const punch = value as Partial<Punch>
  return typeof punch.id === 'string' && typeof punch.at === 'string' && isPunchKind(punch.kind) && !Number.isNaN(Date.parse(punch.at))
}

export function parseCarga(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < CARGA_MIN || value > CARGA_MAX) return null
  return value
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatHours(ms: number, withSeconds = false): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const base = `${hours}h ${String(minutes).padStart(2, '0')}min`
  return withSeconds ? `${base} ${String(seconds).padStart(2, '0')}s` : base
}

export function formatCarga(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function stamp(punch: Punch): number {
  return Date.parse(punch.at)
}

function buildShifts(punches: Punch[]): Shift[] {
  const sorted = [...punches].sort((a, b) => stamp(a) - stamp(b) || a.id.localeCompare(b.id))
  const shifts: Shift[] = []
  let current: Shift | null = null
  let openBreak: BreakSpan | null = null

  for (const punch of sorted) {
    const at = stamp(punch)
    if (punch.kind === 'entrada') {
      if (current && current.end == null) continue
      current = { start: at, end: null, breaks: [] }
      openBreak = null
      shifts.push(current)
      continue
    }
    if (!current || current.end != null) continue
    if (punch.kind === 'intervalo_inicio') {
      if (openBreak) continue
      openBreak = { start: at, end: null }
      current.breaks.push(openBreak)
      continue
    }
    if (punch.kind === 'intervalo_fim') {
      if (!openBreak || openBreak.end != null) continue
      openBreak.end = at
      openBreak = null
      continue
    }
    if (openBreak) continue
    current.end = at
    current = null
    openBreak = null
  }

  return shifts
}

export function shiftState(punches: Punch[]): ShiftState {
  const open = [...buildShifts(punches)].reverse().find((shift) => shift.end == null)
  if (!open) return 'fora'
  return open.breaks.some((span) => span.end == null) ? 'intervalo' : 'trabalhando'
}

export function openShiftStart(punches: Punch[]): number | null {
  const open = [...buildShifts(punches)].reverse().find((shift) => shift.end == null)
  return open ? open.start : null
}

export function canAdd(punches: Punch[], kind: PunchKind): boolean {
  const state = shiftState(punches)
  if (kind === 'entrada') return state === 'fora'
  if (kind === 'intervalo_inicio') return state === 'trabalhando'
  if (kind === 'intervalo_fim') return state === 'intervalo'
  return state === 'trabalhando'
}

function workedSegments(shift: Shift, nowMs: number): Segment[] {
  const shiftEnd = shift.end ?? nowMs
  if (shiftEnd <= shift.start) return []
  const segments: Segment[] = []
  let cursor = shift.start
  const breaks = [...shift.breaks].sort((a, b) => a.start - b.start)
  for (const span of breaks) {
    const breakEnd = span.end ?? nowMs
    const breakStart = Math.min(span.start, shiftEnd)
    if (breakStart > cursor) segments.push({ start: cursor, end: breakStart })
    cursor = Math.max(cursor, Math.min(breakEnd, shiftEnd))
    if (cursor >= shiftEnd) return segments
  }
  if (cursor < shiftEnd) segments.push({ start: cursor, end: shiftEnd })
  return segments
}

function overlap(start: number, end: number, rangeStart: number, rangeEnd: number): number {
  return Math.max(0, Math.min(end, rangeEnd) - Math.max(start, rangeStart))
}

export function workedMsInRange(punches: Punch[], nowMs: number, rangeStart: number, rangeEnd: number): number {
  let total = 0
  for (const shift of buildShifts(punches)) {
    for (const segment of workedSegments(shift, nowMs)) {
      total += overlap(segment.start, segment.end, rangeStart, rangeEnd)
    }
  }
  return total
}

/** valor_a_receber = horas_trabalhadas × (salário mensal ÷ carga horária mensal) */
export function amountDue(workedMs: number, carga: number): number {
  const hours = workedMs / 3_600_000
  return hours * (SALARIO_MENSAL / carga)
}

export function summarize(punches: Punch[], now: Date, carga: number): MonthSummary {
  const bounds = monthBounds(now.getTime())
  const safeCarga = carga > 0 ? carga : CARGA_PADRAO
  const workedMs = workedMsInRange(punches, now.getTime(), bounds.start, bounds.end)
  const hours = workedMs / 3_600_000
  const hourly = SALARIO_MENSAL / safeCarga
  return {
    workedMs,
    hours,
    hourly,
    amount: hours * hourly,
    carga: safeCarga,
  }
}

export function dayRows(punches: Punch[], now: Date): DayRow[] {
  const nowMs = now.getTime()
  const month = monthBounds(nowMs)
  const today = dayKey(nowMs)
  const keys = new Set<string>([today])

  for (const punch of punches) {
    const at = stamp(punch)
    if (at >= month.start && at < month.end) keys.add(dayKey(at))
  }

  const shifts = buildShifts(punches)
  for (const shift of shifts) {
    for (const segment of workedSegments(shift, nowMs)) {
      const from = Math.max(segment.start, month.start)
      const to = Math.min(segment.end, month.end)
      let cursor = from
      while (cursor < to) {
        const key = dayKey(cursor)
        keys.add(key)
        const next = dayBounds(key).end
        if (next <= cursor) break
        cursor = next
      }
    }
  }

  return [...keys]
    .filter((key) => key.startsWith(month.key))
    .sort()
    .reverse()
    .map((key) => describeDay(key, punches, shifts, nowMs, month))
}

function describeDay(
  key: string,
  punches: Punch[],
  shifts: Shift[],
  nowMs: number,
  month: { start: number; end: number },
): DayRow {
  const bounds = dayBounds(key)
  const rangeStart = Math.max(bounds.start, month.start)
  const rangeEnd = Math.min(bounds.end, month.end)
  let workedMs = 0
  let fromPrevious = false
  let intoNext = false
  let live = false

  for (const shift of shifts) {
    if (shift.end == null && shift.start < bounds.end && nowMs >= bounds.start && nowMs < bounds.end) live = true
    for (const segment of workedSegments(shift, nowMs)) {
      const piece = overlap(segment.start, segment.end, rangeStart, rangeEnd)
      workedMs += piece
      if (piece <= 0) continue
      if (segment.start < bounds.start) fromPrevious = true
      if (segment.end > bounds.end) intoNext = true
    }
  }

  const events = punches
    .filter((punch) => {
      const at = stamp(punch)
      return at >= bounds.start && at < bounds.end
    })
    .sort((a, b) => stamp(a) - stamp(b) || a.id.localeCompare(b.id))
    .map((punch) => ({
      id: punch.id,
      time: formatTime(stamp(punch)),
      label: KIND_LABEL[punch.kind],
    }))

  const notes: string[] = []
  if (fromPrevious && intoNext) notes.push('Jornada atravessando a meia-noite.')
  else if (fromPrevious) notes.push('Inclui horas que começaram no dia anterior.')
  else if (intoNext) notes.push('A jornada segue depois da meia-noite.')

  return {
    key,
    label: formatDay(bounds.start + 12 * 3_600_000),
    events,
    workedMs,
    notes,
    live,
  }
}
