import { useEffect, useState } from 'react'
import {
  canAdd,
  dayRows,
  formatBRL,
  formatCarga,
  formatHours,
  openShiftStart,
  parseCarga,
  SALARIO_MENSAL,
  shiftState,
  summarize,
  type Punch,
  type PunchKind,
} from './calc.ts'
import { CARGA_KEY, loadCarga, loadPunches, PUNCHES_KEY, saveCarga, savePunches } from './storage.ts'
import { formatClock, formatMonth, formatWhen } from './time.ts'
import './ponto.css'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function PontoPage() {
  const [punches, setPunches] = useState<Punch[]>(() => loadPunches())
  const [carga, setCarga] = useState(() => loadCarga())
  const [draft, setDraft] = useState(() => formatCarga(loadCarga()))
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const previous = document.title
    document.title = 'Ponto'
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    const onStorage = (event: StorageEvent) => {
      if (event.key === PUNCHES_KEY) setPunches(loadPunches())
      if (event.key === CARGA_KEY) {
        const next = loadCarga()
        setCarga(next)
        setDraft(formatCarga(next))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => {
      document.title = previous
      window.clearInterval(timer)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    const parsed = parseCarga(draft)
    if (parsed == null) return
    const timer = window.setTimeout(() => {
      setCarga(parsed)
      saveCarga(parsed)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [draft])

  const state = shiftState(punches)
  const summary = summarize(punches, now, carga)
  const days = dayRows(punches, now)
  const started = openShiftStart(punches)
  const cargaValid = parseCarga(draft) != null
  const open = state !== 'fora'

  function addPunch(kind: PunchKind) {
    setPunches((current) => {
      if (!canAdd(current, kind)) return current
      const next = [...current, { id: newId(), at: new Date().toISOString(), kind }]
      savePunches(next)
      return next
    })
  }

  function undo() {
    setPunches((current) => {
      if (current.length === 0) return current
      let index = 0
      for (let i = 1; i < current.length; i += 1) {
        if (current[i].at >= current[index].at) index = i
      }
      const next = current.filter((_, i) => i !== index)
      savePunches(next)
      return next
    })
  }

  const statusText =
    state === 'trabalhando' && started != null
      ? `Trabalhando desde ${formatWhen(started, now.getTime())}`
      : state === 'intervalo' && started != null
        ? `Em intervalo. Jornada aberta desde ${formatWhen(started, now.getTime())}`
        : 'Fora do expediente'

  return (
    <main className="ponto">
      <header className="ponto-top">
        <div>
          <h1>Ponto</h1>
          <p className="ponto-month">{formatMonth(now.getTime())}</p>
        </div>
        <time className="ponto-clock" dateTime={now.toISOString()}>
          {formatClock(now.getTime())}
        </time>
      </header>

      <p className={`ponto-status ${state}`}>
        <i />
        {statusText}
      </p>

      <div className="ponto-actions">
        <button type="button" className="ponto-btn primary" disabled={!canAdd(punches, 'entrada')} onClick={() => addPunch('entrada')}>
          Bater entrada
        </button>
        <button
          type="button"
          className={`ponto-btn ${state === 'intervalo' ? 'primary' : 'secondary'}`}
          disabled={!canAdd(punches, 'intervalo_inicio') && !canAdd(punches, 'intervalo_fim')}
          onClick={() => addPunch(state === 'intervalo' ? 'intervalo_fim' : 'intervalo_inicio')}
        >
          {state === 'intervalo' ? 'Encerrar intervalo' : 'Iniciar intervalo'}
        </button>
        <button type="button" className="ponto-btn saida" disabled={!canAdd(punches, 'saida')} onClick={() => addPunch('saida')}>
          Bater saída
        </button>
      </div>
      <p className="ponto-hint">O intervalo não entra nas horas trabalhadas. Só uma jornada fica aberta por vez.</p>

      <section className="ponto-summary" aria-label="Resumo do mês">
        <article className="ponto-hero">
          <p className="ponto-label">Saldo a receber</p>
          <p className="ponto-money">{formatBRL(summary.amount)}</p>
          <p className="ponto-formula">
            {formatHours(summary.workedMs, open)} × ({formatBRL(SALARIO_MENSAL)} ÷ {formatCarga(summary.carga)} h)
          </p>
        </article>
        <div className="ponto-side">
          <article className="ponto-metric">
            <p className="ponto-label">Horas no mês</p>
            <strong>{formatHours(summary.workedMs, open)}</strong>
          </article>
          <article className="ponto-metric">
            <p className="ponto-label">Valor/hora</p>
            <strong>{formatBRL(summary.hourly)}</strong>
            <span>
              {formatBRL(SALARIO_MENSAL)} ÷ {formatCarga(summary.carga)} h
            </span>
          </article>
        </div>
      </section>

      <label className="ponto-carga">
        <span>
          <span className="ponto-label">Carga horária mensal</span>
          <small>Padrão CLT de 220 h. O salário do mês é {formatBRL(SALARIO_MENSAL)}.</small>
        </span>
        <span className="ponto-carga-field">
          <input
            inputMode="decimal"
            aria-invalid={!cargaValid}
            value={draft}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
              const parsed = parseCarga(draft)
              if (parsed == null) {
                setDraft(formatCarga(carga))
                return
              }
              setDraft(formatCarga(parsed))
              setCarga(parsed)
              saveCarga(parsed)
            }}
          />
          <span>horas</span>
        </span>
      </label>
      {!cargaValid ? <p className="ponto-error">Informe um número entre 1 e 744.</p> : null}

      <section className="ponto-days" aria-label="Dias do mês">
        <h2>Dias</h2>
        {days.map((day) => (
          <article key={day.key} className="ponto-day">
            <header>
              <h3>{day.label}</h3>
              <strong>
                {formatHours(day.workedMs, day.live)}
                {day.live ? <em>em andamento</em> : null}
              </strong>
            </header>
            {day.events.length === 0 && day.workedMs === 0 ? (
              <p className="ponto-empty">Nenhuma batida neste dia.</p>
            ) : null}
            <ul>
              {day.events.map((event) => (
                <li key={event.id}>
                  <time>{event.time}</time>
                  <span>{event.label}</span>
                </li>
              ))}
            </ul>
            {day.notes.map((note) => (
              <p key={note} className="ponto-note">
                {note}
              </p>
            ))}
          </article>
        ))}
      </section>

      <button type="button" className="ponto-undo" disabled={punches.length === 0} onClick={undo}>
        Desfazer última batida
      </button>
      <p className="ponto-foot">Horários no fuso de Brasília. As batidas ficam só neste navegador.</p>
    </main>
  )
}
