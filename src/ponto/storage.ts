import { CARGA_PADRAO, isPunch, parseCarga, type Punch } from './calc.ts'

export const PUNCHES_KEY = 'agape-ponto:punches'
export const CARGA_KEY = 'agape-ponto:carga'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore quota or private mode */
  }
}

export function loadPunches(): Punch[] {
  const raw = read(PUNCHES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isPunch)
  } catch {
    return []
  }
}

export function savePunches(punches: Punch[]) {
  write(PUNCHES_KEY, JSON.stringify(punches))
}

export function loadCarga(): number {
  const parsed = parseCarga(read(CARGA_KEY) ?? '')
  return parsed ?? CARGA_PADRAO
}

export function saveCarga(value: number) {
  write(CARGA_KEY, String(value))
}
