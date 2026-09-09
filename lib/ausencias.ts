/**
 * Cálculo con ausencias.
 *
 * Lo importante: una ausencia aprobada **reduce las horas objetivo** del
 * periodo. Sin esto, una semana de vacaciones se leería como incumplimiento de
 * jornada, que era justo el agujero de la versión anterior de la app.
 */
import type { TipoAusencia } from './constants'
import { diasEntre, sumarDias } from './fechas'
import type { Ausencia } from './types'

/** Solo lo aprobado cuenta: una solicitud pendiente no cambia el objetivo. */
export const cuenta = (a: Ausencia) => a.estado === 'aprobada'

/** Conjunto de días (YYYY-MM-DD) cubiertos por ausencias aprobadas del rango. */
export function diasAusentes(
  ausencias: Ausencia[],
  desde: string,
  hasta: string,
): Set<string> {
  const dias = new Set<string>()
  for (const a of ausencias.filter(cuenta)) {
    const ini = a.desde > desde ? a.desde : desde
    const fin = a.hasta < hasta ? a.hasta : hasta
    if (fin < ini) continue
    for (let i = 0; i < diasEntre(ini, fin); i++) dias.add(sumarDias(ini, i))
  }
  return dias
}

/** Cuántos días del periodo están cubiertos por una ausencia aprobada. */
export function diasAusenciaEnPeriodo(
  ausencias: Ausencia[],
  desde: string,
  hasta: string,
): number {
  return diasAusentes(ausencias, desde, hasta).size
}

/** La ausencia aprobada que cubre ese día, si la hay. */
export function ausenciaDelDia(ausencias: Ausencia[], fecha: string): Ausencia | null {
  return ausencias.find((a) => cuenta(a) && a.desde <= fecha && a.hasta >= fecha) ?? null
}

/** Días de vacaciones aprobados y disfrutados en un año natural. */
export function vacacionesUsadas(ausencias: Ausencia[], anio: number): number {
  return diasAusenciaEnPeriodo(
    ausencias.filter((a) => a.tipo === 'vacaciones'),
    `${anio}-01-01`,
    `${anio}-12-31`,
  )
}

/** Días pedidos y aún sin decidir, para avisar de que están comprometidos. */
export function vacacionesPendientes(ausencias: Ausencia[], anio: number): number {
  const pendientes = ausencias.filter(
    (a) => a.tipo === 'vacaciones' && a.estado === 'pendiente',
  )
  // Aquí sí interesan las pendientes, así que se cuentan a mano.
  let total = 0
  for (const a of pendientes) {
    const ini = a.desde > `${anio}-01-01` ? a.desde : `${anio}-01-01`
    const fin = a.hasta < `${anio}-12-31` ? a.hasta : `${anio}-12-31`
    if (fin >= ini) total += diasEntre(ini, fin)
  }
  return total
}

export function resumenVacaciones(
  ausencias: Ausencia[],
  diasAlAnio: number,
  anio: number,
): { total: number; usados: number; pendientes: number; restantes: number } {
  const usados = vacacionesUsadas(ausencias, anio)
  const pendientes = vacacionesPendientes(ausencias, anio)
  return {
    total: diasAlAnio,
    usados,
    pendientes,
    restantes: Math.max(0, diasAlAnio - usados - pendientes),
  }
}

/** Etiqueta corta para el calendario. */
export const ABREVIA_AUSENCIA: Record<TipoAusencia, string> = {
  vacaciones: 'Vac.',
  baja: 'Baja',
  permiso: 'Permiso',
  asuntos_propios: 'Propios',
  falta: 'Falta',
}
