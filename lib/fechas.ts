import { TZ } from './constants'

/** Offset de la zona respecto a UTC, en ms, en ese instante concreto. */
function offsetTz(fecha: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const partes = dtf.formatToParts(fecha)
  const v = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  const comoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'), v('second'))
  return comoUtc - fecha.getTime()
}

/** 'YYYY-MM-DD' del día natural en la zona indicada. */
export function fechaLocal(ts: string | Date, tz: string = TZ): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

/** 'HH:MM' en la zona indicada. */
export function horaLocal(ts: string | Date | null, tz: string = TZ): string {
  if (!ts) return '—'
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
}

/** Instante UTC que corresponde a una hora de pared local ('2026-09-09','09:00'). */
export function instanteLocal(fecha: string, hora: string, tz: string = TZ): Date {
  const [y, m, d] = fecha.split('-').map(Number)
  const [hh, mm] = hora.split(':').map(Number)
  const ingenuo = Date.UTC(y, m - 1, d, hh, mm)
  let ts = ingenuo
  // Dos pasadas convergen incluso en los cambios de hora.
  for (let i = 0; i < 2; i++) ts = ingenuo - offsetTz(new Date(ts), tz)
  return new Date(ts)
}

/** Fin del turno como instante, sumando un día si cruza medianoche. */
export function finTurno(fecha: string, horaInicio: string, horaFin: string, tz: string = TZ): Date {
  const inicio = instanteLocal(fecha, horaInicio, tz)
  const fin = instanteLocal(fecha, horaFin, tz)
  return fin > inicio ? fin : new Date(fin.getTime() + 86400000)
}

export function hoyLocal(tz: string = TZ): string {
  return fechaLocal(new Date(), tz)
}

export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + dias)
  return t.toISOString().slice(0, 10)
}

/** Lunes de la semana de esa fecha. */
export function inicioSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const dow = t.getUTCDay() // 0 = domingo
  return sumarDias(fecha, dow === 0 ? -6 : 1 - dow)
}

export function finSemana(fecha: string): string {
  return sumarDias(inicioSemana(fecha), 6)
}

/**
 * Número de semana ISO 8601: la semana empieza en lunes y la semana 1 es la
 * que contiene el primer jueves del año. Es el número con el que la gente
 * habla ("la semana 37"), y el que usa el planificador.
 */
export function numeroSemanaISO(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  // Al jueves de esa semana: así el año que manda es el del jueves.
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)
  const enero1 = Date.UTC(t.getUTCFullYear(), 0, 1)
  return Math.ceil(((t.getTime() - enero1) / 86400000 + 1) / 7)
}

/** Año al que pertenece la semana ISO (puede no ser el del día). */
export function anioSemanaISO(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const dow = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dow)
  return t.getUTCFullYear()
}

/** 'del 7 al 13 de septiembre' — el rango de la semana, en una línea. */
export function rangoSemanaTxt(inicio: string, tz: string = TZ): string {
  const fin = sumarDias(inicio, 6)
  const dia = (f: string) => new Date(`${f}T12:00:00Z`)
  const mismoMes = inicio.slice(0, 7) === fin.slice(0, 7)
  const desde = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    day: 'numeric',
    ...(mismoMes ? {} : { month: 'short' }),
  }).format(dia(inicio))
  const hasta = new Intl.DateTimeFormat('es-ES', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
  }).format(dia(fin))
  return `del ${desde} al ${hasta}`
}

export function inicioMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

export function finMes(fecha: string): string {
  const [y, m] = fecha.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00Z`).getTime()
  const b = new Date(`${hasta}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000) + 1
}

/** 'HH:MM[:SS]' → minutos desde medianoche. */
export function horaAMinutos(hora: string): number {
  const [hh, mm] = hora.split(':').map(Number)
  return hh * 60 + mm
}

/** 452 → '7 h 32 min'. Negativos incluidos. */
export function formatMinutos(min: number): string {
  const signo = min < 0 ? '−' : ''
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h === 0) return `${signo}${m} min`
  if (m === 0) return `${signo}${h} h`
  return `${signo}${h} h ${m} min`
}

/** 452 → '7:32'. Formato de nómina. */
export function formatHoras(min: number): string {
  const signo = min < 0 ? '-' : ''
  const abs = Math.abs(Math.round(min))
  return `${signo}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}

/** '08/09/2026' a partir de un instante ISO o de un 'YYYY-MM-DD'. */
export function formatFechaCorta(ts: string | Date, tz: string = TZ): string {
  const d = typeof ts === 'string' && ts.length === 10 ? new Date(`${ts}T12:00:00Z`) : new Date(ts)
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
}

export function formatFechaLarga(fecha: string, tz: string = TZ): string {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(`${fecha}T12:00:00Z`))
}
