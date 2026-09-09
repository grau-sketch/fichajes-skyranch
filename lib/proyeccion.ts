import { TZ } from './constants'
import { diasEntre, finTurno } from './fechas'
import { minutosTurno, turnosSinFichar, type Jornada } from './jornada'
import type { Turno } from './types'

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
}

/** Objetivo en minutos de un rango de fechas, prorrateado por semanas. */
export function objetivoPeriodoMin(
  horasSemana: number,
  desde: string,
  hasta: string,
): number {
  return Math.round((horasSemana * 60 * diasEntre(desde, hasta)) / 7)
}

export function proyectar(opciones: {
  jornadas: Jornada[]
  turnos: Turno[]
  horasSemana: number
  desde: string
  hasta: string
  ahora?: Date
  tz?: string
}): Proyeccion {
  const { jornadas, turnos, horasSemana, desde, hasta } = opciones
  const ahora = opciones.ahora ?? new Date()
  const tz = opciones.tz ?? TZ

  const enRango = <T extends { fecha: string }>(x: T) => x.fecha >= desde && x.fecha <= hasta
  const js = jornadas.filter(enRango)
  const ts = turnos.filter((t) => enRango(t) && t.estado !== 'cancelado')

  const objetivo_min = objetivoPeriodoMin(horasSemana, desde, hasta)
  const trabajado_min = js.reduce((s, j) => s + j.minutos_trabajados, 0)

  const pendientes = ts.filter((t) => finTurno(t.fecha, t.hora_inicio, t.hora_fin, tz) > ahora)
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
    turnos_sin_fichar: turnosSinFichar(ts, js, ahora, tz).length,
    no_llega: proyectado_min < objetivo_min,
  }
}
