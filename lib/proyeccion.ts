import { TZ } from './constants'
import { diasAusentes } from './ausencias'
import { diasEntre, finTurno } from './fechas'
import { minutosTurno, turnosSinFichar, type Jornada } from './jornada'
import type { Ausencia, Turno } from './types'

export type Proyeccion = {
  /** Objetivo del periodo según contrato, en minutos. */
  objetivo_min: number
  /** Ya trabajado y fichado. */
  trabajado_min: number
  /** Suma de turnos planificados que aún no han terminado. */
  pendiente_min: number
  /** trabajado + pendiente: adónde llegas si cumples lo planificado. */
  proyectado_min: number
  /** proyectado − objetivo. Negativo = te vas a quedar corto. */
  desviacion_min: number
  /** Lo que te falta fichar para llegar al objetivo. */
  restante_min: number
  turnos_pendientes: number
  turnos_sin_fichar: number
  /** true si con lo planificado no se llega al objetivo del periodo. */
  no_llega: boolean
  /** Días del periodo cubiertos por una ausencia aprobada. */
  dias_ausencia: number
}

/**
 * Objetivo en minutos de un rango de fechas, prorrateado por semanas.
 *
 * `diasAusencia` descuenta los días de vacaciones, baja o permiso: si no, una
 * semana fuera aparecería como incumplimiento de jornada.
 */
export function objetivoPeriodoMin(
  horasSemana: number,
  desde: string,
  hasta: string,
  diasAusencia = 0,
): number {
  const dias = Math.max(0, diasEntre(desde, hasta) - diasAusencia)
  return Math.round((horasSemana * 60 * dias) / 7)
}

export function proyectar(opciones: {
  jornadas: Jornada[]
  turnos: Turno[]
  horasSemana: number
  desde: string
  hasta: string
  /** Ausencias de la persona; solo las aprobadas descuentan. */
  ausencias?: Ausencia[]
  ahora?: Date
  tz?: string
}): Proyeccion {
  const { jornadas, turnos, horasSemana, desde, hasta } = opciones
  const ahora = opciones.ahora ?? new Date()
  const tz = opciones.tz ?? TZ

  const enRango = <T extends { fecha: string }>(x: T) => x.fecha >= desde && x.fecha <= hasta
  const js = jornadas.filter(enRango)
  const ts = turnos.filter((t) => enRango(t) && t.estado !== 'cancelado')

  const ausentes = diasAusentes(opciones.ausencias ?? [], desde, hasta)
  const objetivo_min = objetivoPeriodoMin(horasSemana, desde, hasta, ausentes.size)
  const trabajado_min = js.reduce((s, j) => s + j.minutos_trabajados, 0)

  // Un turno que cae en un día de ausencia aprobada ya no se espera cumplir.
  const pendientes = ts.filter(
    (t) => finTurno(t.fecha, t.hora_inicio, t.hora_fin, tz) > ahora && !ausentes.has(t.fecha),
  )
  const pendiente_min = pendientes.reduce((s, t) => s + minutosTurno(t), 0)
  const proyectado_min = trabajado_min + pendiente_min

  return {
    objetivo_min,
    trabajado_min,
    pendiente_min,
    proyectado_min,
    desviacion_min: proyectado_min - objetivo_min,
    restante_min: Math.max(0, objetivo_min - trabajado_min),
    turnos_pendientes: pendientes.length,
    turnos_sin_fichar: turnosSinFichar(ts, js, ahora, tz, ausentes).length,
    no_llega: proyectado_min < objetivo_min,
    dias_ausencia: ausentes.size,
  }
}
