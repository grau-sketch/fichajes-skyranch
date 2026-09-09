import { NextResponse, type NextRequest } from 'next/server'
import { ETIQUETA_ANOMALIA, ETIQUETA_ORIGEN, ETIQUETA_TIPO, TZ } from '@/lib/constants'
import {
  fechaLocal,
  finMes,
  formatHoras,
  horaLocal,
  hoyLocal,
  inicioMes,
  sumarDias,
} from '@/lib/fechas'
import { diasAusentes } from '@/lib/ausencias'
import { ETIQUETA_AUSENCIA } from '@/lib/constants'
import { agruparJornadas, minutosTurno, turnosSinFichar } from '@/lib/jornada'
import { createClient } from '@/lib/supabase/server'
import type { Ausencia, Centro, Fichaje, Perfil, Turno } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const SEP = ';' // Excel en español espera punto y coma

function celda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

function respuestaCsv(lineas: string[], nombre: string): NextResponse {
  // BOM para que Excel reconozca el UTF-8 y respete las tildes.
  const cuerpo = `﻿${lineas.join('\r\n')}\r\n`
  return new NextResponse(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombre}"`,
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * Informe de registro de jornada en CSV. Dos modos:
 *  · por defecto: una fila por jornada, más las filas de los turnos que
 *    pasaron sin fichar.
 *  · `detalle=movimientos`: una fila por fichaje, incluidos los anulados, con
 *    quién lo tocó y por qué. Es la trazabilidad para una inspección.
 *
 * El alcance lo decide RLS: un trabajador solo puede descargar lo suyo; el
 * encargado, su centro; el administrador, todo.
 */
export async function GET(peticion: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse('No autorizado', { status: 401 })

  const params = peticion.nextUrl.searchParams
  const hoy = hoyLocal()
  const desde = FECHA.test(params.get('desde') ?? '') ? params.get('desde')! : inicioMes(hoy)
  const hasta = FECHA.test(params.get('hasta') ?? '') ? params.get('hasta')! : finMes(hoy)
  const empleado = params.get('empleado')
  const movimientos = params.get('detalle') === 'movimientos'

  if (desde > hasta) return new NextResponse('Rango de fechas no válido', { status: 400 })

  let consultaFichajes = supabase
    .from('fichajes')
    .select('*')
    .gte('ts', `${sumarDias(desde, -1)}T00:00:00`)
    .lte('ts', `${sumarDias(hasta, 2)}T00:00:00`)
    .order('ts', { ascending: true })
  let consultaTurnos = supabase
    .from('turnos')
    .select('*')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .neq('estado', 'cancelado')

  let consultaAusencias = supabase
    .from('ausencias')
    .select('*')
    .eq('estado', 'aprobada')
    .lte('desde', hasta)
    .gte('hasta', desde)

  if (empleado && empleado !== 'todos') {
    consultaFichajes = consultaFichajes.eq('empleado_id', empleado)
    consultaTurnos = consultaTurnos.eq('empleado_id', empleado)
    consultaAusencias = consultaAusencias.eq('empleado_id', empleado)
  }

  const [resFichajes, resTurnos, resPerfiles, resCentros, resAusencias] = await Promise.all([
    consultaFichajes,
    consultaTurnos,
    supabase.from('perfiles').select('*'),
    supabase.from('centros').select('*'),
    consultaAusencias,
  ])

  if (resFichajes.error) return new NextResponse('Error al leer los fichajes', { status: 500 })

  const perfilesLista = (resPerfiles.data ?? []) as Perfil[]
  const perfiles = new Map(perfilesLista.map((p) => [p.id, p]))
  const nombrePor = Object.fromEntries(perfilesLista.map((p) => [p.id, p.nombre]))
  const centros = new Map(((resCentros.data ?? []) as Centro[]).map((c) => [c.id, c]))
  const turnos = (resTurnos.data ?? []) as Turno[]
  const ausencias = (resAusencias.data ?? []) as Ausencia[]

  const porEmpleado = new Map<string, Fichaje[]>()
  for (const f of (resFichajes.data ?? []) as Fichaje[]) {
    const lista = porEmpleado.get(f.empleado_id) ?? []
    lista.push(f)
    porEmpleado.set(f.empleado_id, lista)
  }

  const ids = [...new Set([...porEmpleado.keys(), ...turnos.map((t) => t.empleado_id)])].sort(
    (a, b) => (perfiles.get(a)?.nombre ?? '').localeCompare(perfiles.get(b)?.nombre ?? ''),
  )

  const datosDe = (id: string) => {
    const perfil = perfiles.get(id)
    return {
      perfil,
      nombre: perfil?.nombre ?? id,
      email: perfil?.email ?? '',
      centro: perfil?.centro_id ? centros.get(perfil.centro_id)?.nombre ?? '' : '',
    }
  }

  // ---------------------------------------------------------------- movimientos
  if (movimientos) {
    const cabeceras = [
      'Empleado', 'Usuario', 'Centro', 'Fecha', 'Hora', 'Movimiento', 'Origen',
      'Ubicacion', 'Distancia al centro (m)', 'Precision GPS (m)',
      'Estado', 'Corrige a', 'Modificado por', 'Anulado por', 'Motivo', 'Registrado en',
    ]
    const lineas = [cabeceras.join(SEP)]

    for (const id of ids) {
      const { nombre, email, centro } = datosDe(id)
      const todos = porEmpleado.get(id) ?? []
      const indice = new Map(todos.map((f) => [f.id, f]))
      const enRango = todos
        .filter((f) => {
          const dia = fechaLocal(f.ts, TZ)
          return dia >= desde && dia <= hasta
        })
        .sort((a, b) => a.ts.localeCompare(b.ts))

      for (const f of enRango) {
        const original = f.corrige_a ? indice.get(f.corrige_a) : undefined
        lineas.push(
          [
            celda(nombre), celda(email), celda(centro),
            celda(fechaLocal(f.ts, TZ)),
            celda(horaLocal(f.ts, TZ)),
            celda(ETIQUETA_TIPO[f.tipo]),
            celda(ETIQUETA_ORIGEN[f.origen]),
            celda(
              f.dentro_radio === true
                ? 'En el centro'
                : f.dentro_radio === false
                  ? 'Fuera del centro'
                  : 'Sin ubicacion',
            ),
            celda(f.distancia_m === null ? '' : Math.round(Number(f.distancia_m))),
            celda(f.precision_m === null ? '' : Math.round(Number(f.precision_m))),
            celda(f.anulado_en === null ? 'Vigente' : 'Anulado'),
            celda(
              original
                ? `${fechaLocal(original.ts, TZ)} ${horaLocal(original.ts, TZ)} (${ETIQUETA_TIPO[original.tipo]})`
                : '',
            ),
            celda(f.editado_por ? nombrePor[f.editado_por] ?? f.editado_por : ''),
            celda(f.anulado_por ? nombrePor[f.anulado_por] ?? f.anulado_por : ''),
            celda(f.motivo_anulacion ?? f.nota ?? ''),
            celda(f.creado_en ? `${fechaLocal(f.creado_en, TZ)} ${horaLocal(f.creado_en, TZ)}` : ''),
          ].join(SEP),
        )
      }
    }

    lineas.push('')
    lineas.push(celda(`Historial de movimientos del ${desde} al ${hasta}`))
    return respuestaCsv(lineas, `historial-fichajes_${desde}_${hasta}.csv`)
  }

  // ------------------------------------------------------------------ jornadas
  const cabeceras = [
    'Empleado', 'Usuario', 'Centro', 'Fecha', 'Estado', 'Entrada', 'Salida',
    'Pausa (h:mm)', 'Trabajado (h:mm)', 'Trabajado (min)', 'Planificado (h:mm)',
    'Ubicacion verificada', 'Distancia max (m)', 'Modificado a mano', 'Fichajes anulados',
    'Incidencias',
  ]
  const lineas = [cabeceras.join(SEP)]

  let totalMin = 0
  for (const id of ids) {
    const { perfil, nombre, email, centro } = datosDe(id)
    const todos = porEmpleado.get(id) ?? []
    const jornadas = agruparJornadas(todos, new Date(), TZ)
      .filter((j) => j.fecha >= desde && j.fecha <= hasta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const susTurnos = turnos.filter((t) => t.empleado_id === id)

    const planificadoDe = (fecha: string) =>
      susTurnos.filter((t) => t.fecha === fecha).reduce((s, t) => s + minutosTurno(t), 0)

    // Anulados del día, que no salen en la jornada porque no cuentan.
    const anuladosDe = (fecha: string) =>
      todos.filter((f) => f.anulado_en !== null && fechaLocal(f.ts, TZ) === fecha).length

    const filas: { fecha: string; linea: string }[] = []

    for (const j of jornadas) {
      totalMin += j.minutos_trabajados
      const distancias = j.fichajes
        .map((f) => (f.distancia_m === null ? null : Number(f.distancia_m)))
        .filter((d): d is number => d !== null)
      const verificada = j.fichajes.every((f) => f.dentro_radio === true)
      const tocada = j.fichajes.some((f) => f.origen === 'manual' || f.corrige_a !== null)

      filas.push({
        fecha: j.fecha,
        linea: [
          celda(nombre), celda(email), celda(centro),
          celda(j.fecha),
          celda(j.abierta ? 'Abierta' : 'Fichada'),
          celda(horaLocal(j.entrada, TZ)),
          celda(j.abierta ? 'sin salida' : horaLocal(j.salida, TZ)),
          celda(formatHoras(j.minutos_pausa)),
          celda(formatHoras(j.minutos_trabajados)),
          celda(j.minutos_trabajados),
          celda(planificadoDe(j.fecha) > 0 ? formatHoras(planificadoDe(j.fecha)) : ''),
          celda(verificada ? 'Si' : 'No'),
          celda(distancias.length > 0 ? Math.round(Math.max(...distancias)) : ''),
          celda(tocada ? 'Si' : 'No'),
          celda(anuladosDe(j.fecha)),
          celda(j.anomalias.map((a) => ETIQUETA_ANOMALIA[a]).join(', ')),
        ].join(SEP),
      })
    }

    const susAusencias = ausencias.filter((a) => a.empleado_id === id)
    const ausentes = diasAusentes(susAusencias, desde, hasta)

    // Los días de ausencia aprobada salen como tales, no como incumplimiento.
    for (const a of susAusencias) {
      const ini = a.desde > desde ? a.desde : desde
      const fin = a.hasta < hasta ? a.hasta : hasta
      if (fin < ini) continue
      filas.push({
        fecha: ini,
        linea: [
          celda(nombre), celda(email), celda(centro),
          celda(ini === fin ? ini : `${ini} a ${fin}`),
          celda(ETIQUETA_AUSENCIA[a.tipo].toUpperCase()),
          '', '', '', celda('0:00'), celda(0),
          '', '', '', celda('No'), celda(0),
          celda(a.motivo ?? ETIQUETA_AUSENCIA[a.tipo]),
        ].join(SEP),
      })
    }

    // Turnos planificados que pasaron sin ningún fichaje: quedan explícitos.
    for (const t of turnosSinFichar(susTurnos, jornadas, new Date(), TZ, ausentes)) {
      filas.push({
        fecha: t.fecha,
        linea: [
          celda(nombre), celda(email), celda(centro),
          celda(t.fecha),
          celda('SIN FICHAR'),
          '', '', '', celda('0:00'), celda(0),
          celda(formatHoras(minutosTurno(t))),
          '', '', celda('No'), celda(anuladosDe(t.fecha)),
          celda('Turno sin fichar'),
        ].join(SEP),
      })
    }

    for (const fila of filas.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      lineas.push(fila.linea)
    }

    if (perfil && filas.length > 0) {
      const trabajado = jornadas.reduce((s, j) => s + j.minutos_trabajados, 0)
      const planificado = susTurnos.reduce((s, t) => s + minutosTurno(t), 0)
      lineas.push(
        [
          celda(`${nombre} — TOTAL`), '', celda(centro), celda(`${desde} a ${hasta}`), '', '', '', '',
          celda(formatHoras(trabajado)), celda(trabajado), celda(formatHoras(planificado)),
          '', '', '', '',
          celda(`Desviacion ${formatHoras(trabajado - planificado)}`),
        ].join(SEP),
      )
      lineas.push('')
    }
  }

  lineas.push(
    ['TOTAL GENERAL', '', '', celda(`${desde} a ${hasta}`), '', '', '', '', celda(formatHoras(totalMin)), celda(totalMin)].join(SEP),
  )

  return respuestaCsv(lineas, `registro-jornada_${desde}_${hasta}.csv`)
}
