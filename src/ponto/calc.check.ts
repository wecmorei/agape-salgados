import {
  amountDue,
  canAdd,
  dayRows,
  formatBRL,
  shiftState,
  summarize,
  workedMsInRange,
  type Punch,
} from './calc.ts'
import { monthBounds, zonedToUtc } from './time.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function punch(id: string, kind: Punch['kind'], ms: number): Punch {
  return { id, kind, at: new Date(ms).toISOString() }
}

const hour = 3_600_000
const november = zonedToUtc(2026, 11, 15, 12, 0, 0)
const now = new Date(november)
const bounds = monthBounds(november)

assert(bounds.end - bounds.start === 30 * 24 * hour, 'novembro de 2026 tem 30 dias no fuso de Brasília')
assert(zonedToUtc(2026, 11, 1, 0, 0, 0) === Date.parse('2026-11-01T03:00:00.000Z'), 'meia-noite em São Paulo é 03:00 UTC')

const start = zonedToUtc(2026, 11, 2, 8, 0, 0)
const punches: Punch[] = [
  punch('in', 'entrada', start),
  punch('out', 'saida', start + 110 * hour),
]
const summary = summarize(punches, now, 220)
assert(summary.workedMs === 110 * hour, `110h exatas, veio ${summary.workedMs}`)
assert(summary.amount === 4250, `110h de 220h deve dar 4250, veio ${summary.amount}`)
assert(amountDue(110 * hour, 220) === 4250, 'fórmula direta')
assert(formatBRL(summary.amount).includes('4.250,00'), `formato BRL, veio ${formatBRL(summary.amount)}`)
assert(summarize(punches, now, 110).amount === 8500, 'carga igual às horas devolve o salário cheio')

const days = dayRows(punches, now)
const daySum = days.reduce((sum, day) => sum + day.workedMs, 0)
assert(daySum === summary.workedMs, 'a soma dos dias fecha com o mês')
const middle = days.find((day) => day.key === '2026-11-04')
assert(middle?.workedMs === 24 * hour, 'dia no meio da jornada tem 24h')
assert(middle?.events.length === 0, 'dia no meio não tem batida')
assert(middle?.notes.length === 1, `uma nota para a meia-noite, veio ${middle?.notes.join(' | ')}`)

const breakStart = zonedToUtc(2026, 11, 10, 8, 0, 0)
const withBreak: Punch[] = [
  punch('e', 'entrada', breakStart),
  punch('bi', 'intervalo_inicio', zonedToUtc(2026, 11, 10, 12, 0, 0)),
  punch('bf', 'intervalo_fim', zonedToUtc(2026, 11, 10, 13, 0, 0)),
  punch('s', 'saida', zonedToUtc(2026, 11, 10, 17, 0, 0)),
]
assert(workedMsInRange(withBreak, now.getTime(), bounds.start, bounds.end) === 8 * hour, 'intervalo de 1h sai das 9h de presença')

const openNow = new Date(zonedToUtc(2026, 11, 10, 15, 0, 0))
const openShift: Punch[] = [
  punch('e', 'entrada', zonedToUtc(2026, 11, 10, 8, 0, 0)),
  punch('bi', 'intervalo_inicio', zonedToUtc(2026, 11, 10, 12, 0, 0)),
  punch('bf', 'intervalo_fim', zonedToUtc(2026, 11, 10, 13, 0, 0)),
]
assert(shiftState(openShift) === 'trabalhando', 'depois do intervalo segue trabalhando')
assert(summarize(openShift, openNow, 220).workedMs === 6 * hour, 'jornada aberta conta até agora, sem o intervalo')
assert(!canAdd(openShift, 'entrada'), 'não abre outra entrada com jornada aberta')
assert(canAdd(openShift, 'saida'), 'pode bater saída')

const onBreak: Punch[] = [...openShift, punch('b2', 'intervalo_inicio', zonedToUtc(2026, 11, 10, 14, 0, 0))]
assert(shiftState(onBreak) === 'intervalo', 'intervalo aberto')
assert(!canAdd(onBreak, 'saida'), 'saída espera o fim do intervalo')
assert(summarize(onBreak, openNow, 220).workedMs === 5 * hour, 'intervalo em andamento não conta')

const monthStart = bounds.start
const crossing: Punch[] = [
  punch('e', 'entrada', monthStart - 10 * hour),
  punch('s', 'saida', monthStart + 5 * hour),
]
assert(summarize(crossing, now, 220).workedMs === 5 * hour, 'só conta o trecho dentro do mês')

console.log('ponto ok', formatBRL(4250))
