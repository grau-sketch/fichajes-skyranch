import type { Anomalia } from './constants'
import { TZ } from './constants'
import { fechaLocal, finTurno, hoyLocal, horaAMinutos } from './fechas'
import type { Fichaje, Turno } from './types'

export type Jornada = {
  empleado_id: string
  /** Día natural al que se imputa la jornada: el de la entrada. */
  fecha: string
  entrada: string | null
  salida: string | null
  minutos_trabajados: number
  minutos_pausa: number
  abierta: boolean
  anomalias: Anomalia[]
  fichajes: Fichaje[]
}

/**
 * Reconstruye jornadas a partir de los fichajes en bruto.
 *
 * Una jornada empieza en 'entrada' y termina en 'salida', aunque cruce
 * medianoche; se imputa siempre al día de la entrada. Las pausas se descuentan.
 * Los fichajes deben venir del mismo empleado.
 */
export function agruparJornadas(
  fichajes: Fichaje[],
  ahora: Date = new Date(),
  tz: string = TZ,
): Jornada[] {
  // Los fichajes anulados por un responsable no cuentan para las horas, pero
  // siguen existiendo en la base para el historial.
  const orden = fichajes
    .filter((f) => f.anulado_en === null)
    .sort((a, b) => a.ts.localeCompare(b.ts))
  const jornadas: Jornada[] = []
  const hoy = fechaLocal(ahora, tz)

  let actual: Jornada | null = null
  let pausaDesde: number | null = null

  const cerrar = (finTs: number, salida: string | null) => {
    if (!actual) return
    if (pausaDesde !== null) {
      actual.minutos_pausa += Math.max(0, (finTs - pausaDesde) / 60000)
      actual.anomalias.push('pausa_abierta')
      pausaDesde = null
    }
    const inicio = actual.entrada ? new Date(actual.entrada).getTime() : finTs
    actual.salida = salida
    actual.minutos_trabajados = Math.max(
      0,
      Math.round((finTs - inicio) / 60000 - actual.minutos_pausa),
    )
    actual.minutos_pausa = Math.round(actual.minutos_pausa)
    jornadas.push(actual)
    actual = null
  }

  for (const f of orden) {
    const t = new Date(f.ts).getTime()

    if (f.tipo === 'entrada') {
      if (actual) {
        // Entrada sobre una jornada abierta: se cierra con el último evento.
        const ultimo = actual.fichajes[actual.fichajes.length - 1]
        actual.anomalias.push('sin_salida')
        cerrar(ultimo ? new Date(ultimo.ts).getTime() : t, null)
      }
      actual = {
        empleado_id: f.empleado_id,
        fecha: fechaLocal(f.ts, tz),
        entrada: f.ts,
        salida: null,
        minutos_trabajados: 0,
        minutos_pausa: 0,
        abierta: false,
        anomalias: [],
        fichajes: [f],
      }
      continue
    }

    if (!actual) continue // pausa o salida huérfana: se ignora en el cómputo
    actual.fichajes.push(f)

    if (f.tipo === 'pausa_inicio') {
      pausaDesde = t
    } else if (f.tipo === 'pausa_fin') {
      if (pausaDesde !== null) {
        actual.minutos_pausa += Math.max(0, (t - pausaDesde) / 60000)
        pausaDesde = null
      }
    } else if (f.tipo === 'salida') {
      cerrar(t, f.ts)
    }
  }

  if (actual) {
    const abierta: Jornada = actual
    const inicio = abierta.entrada ? new Date(abierta.entrada).getTime() : ahora.getTime()
    let pausa = abierta.minutos_pausa
    if (pausaDesde !== null) pausa += Math.max(0, (ahora.getTime() - pausaDesde) / 60000)
    abierta.abierta = true
    abierta.minutos_pausa = Math.round(pausa)
    abierta.minutos_trabajados = Math.max(
      0,
      Math.round((ahora.getTime() - inicio) / 60000 - pausa),
    )
    // Solo es anomalía si el día ya pasó; hoy simplemente sigue trabajando.
    if (abierta.fecha !== hoy) abierta.anomalias.push('sin_salida')
    jornadas.push(abierta)
  }

  for (const j of jornadas) marcarAnomaliasUbicacion(j)
  return jornadas.sort((a, b) => b.fecha.localeCompare(a.fecha))
}

function marcarAnomaliasUbicacion(j: Jornada): void {
  const set = new Set<Anomalia>(j.anomalias)
  for (const f of j.fichajes) {
    if (f.dentro_radio === false) set.add('fuera_de_radio')
    if (f.lat === null || f.lon === null) set.add('sin_ubicacion')
    if (f.origen === 'manual' || f.corrige_a !== null) set.add('corregido')
  }
  j.anomalias = [...set]
}

export type ResumenJornadas = {
  dias: number
  minutos_trabajados: number
  minutos_pausa: number
  jornadas_abiertas: number
  con_anomalias: number
}

export function resumirJornadas(jornadas: Jornada[]): ResumenJornadas {
  return {
    dias: new Set(jornadas.map((j) => j.fecha)).size,
    minutos_trabajados: jornadas.reduce((s, j) => s + j.minutos_trabajados, 0),
    minutos_pausa: jornadas.reduce((s, j) => s + j.minutos_pausa, 0),
    jornadas_abiertas: jornadas.filter((j) => j.abierta).length,
    con_anomalias: jornadas.filter((j) => j.anomalias.length > 0).length,
  }
}

/** Minutos planificados de un turno, cruzando medianoche si hace falta. */
export function minutosTurno(t: Pick<Turno, 'hora_inicio' | 'hora_fin' | 'pausa_min'>): number {
  const ini = horaAMinutos(t.hora_inicio)
  const fin = horaAMinutos(t.hora_fin)
  const bruto = fin >= ini ? fin - ini : fin - ini + 1440
  return Math.max(0, bruto - (t.pausa_min ?? 0))
}

/** Turnos ya terminados sin ninguna jornada imputada a ese día. */
export function turnosSinFichar(
  turnos: Turno[],
  jornadas: Jornada[],
  ahora: Date = new Date(),
  tz: string = TZ,
): Turno[] {
  const conFichaje = new Set(jornadas.map((j) => j.fecha))
  return turnos.filter(
    (t) =>
      t.estado !== 'cancelado' &&
      finTurno(t.fecha, t.hora_inicio, t.hora_fin, tz) < ahora &&
      !conFichaje.has(t.fecha),
  )
}

/** El turno de hoy que toca ahora (o el siguiente de hoy). */
export function turnoDeHoy(turnos: Turno[], tz: string = TZ): Turno | null {
  const hoy = hoyLocal(tz)
  const deHoy = turnos
    .filter((t) => t.fecha === hoy && t.estado !== 'cancelado')
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
  return deHoy[0] ?? null
}
