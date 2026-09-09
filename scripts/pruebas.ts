/* Pruebas de la lógica de cálculo. No necesita base de datos.
   Ejecutar:  bun run scripts/pruebas.ts                                  */

import { finTurno, formatHoras, formatMinutos, inicioSemana, instanteLocal } from '../lib/fechas'
import { agruparJornadas, minutosTurno, turnosSinFichar } from '../lib/jornada'
import { objetivoPeriodoMin, proyectar } from '../lib/proyeccion'
import type { Fichaje, Turno } from '../lib/types'

let fallos = 0
let total = 0

function comprobar(nombre: string, real: unknown, esperado: unknown) {
  total++
  const a = JSON.stringify(real)
  const b = JSON.stringify(esperado)
  if (a === b) {
    console.log(`  ok   ${nombre}`)
  } else {
    fallos++
    console.log(`  FALLO ${nombre}\n        esperado ${b}\n        obtenido ${a}`)
  }
}

let n = 0
function f(tipo: Fichaje['tipo'], ts: string, extra: Partial<Fichaje> = {}): Fichaje {
  return {
    id: `f${++n}`,
    empleado_id: 'e1',
    centro_id: 'c1',
    tipo,
    ts,
    lat: 40.4,
    lon: -3.7,
    precision_m: 12,
    distancia_m: 20,
    dentro_radio: true,
    origen: 'app',
    nota: null,
    editado_por: null,
    editado_en: null,
    anulado_por: null,
    anulado_en: null,
    motivo_anulacion: null,
    corrige_a: null,
    creado_en: ts,
    ...extra,
  }
}

function t(fecha: string, hora_inicio: string, hora_fin: string, pausa_min = 0): Turno {
  return {
    id: `t${fecha}${hora_inicio}`,
    empleado_id: 'e1',
    centro_id: 'c1',
    fecha,
    hora_inicio,
    hora_fin,
    pausa_min,
    estado: 'planificado',
    nota: null,
  }
}

const TZ = 'Europe/Madrid'

console.log('\nFechas y horarios')
// Madrid en septiembre está en CEST (UTC+2).
comprobar('instanteLocal verano', instanteLocal('2026-09-09', '09:00', TZ).toISOString(), '2026-09-09T07:00:00.000Z')
// En enero está en CET (UTC+1).
comprobar('instanteLocal invierno', instanteLocal('2026-01-15', '09:00', TZ).toISOString(), '2026-01-15T08:00:00.000Z')
// El domingo del cambio de hora: a las 02:00 se salta a las 03:00.
comprobar('instanteLocal cambio de hora', instanteLocal('2026-03-29', '09:00', TZ).toISOString(), '2026-03-29T07:00:00.000Z')
comprobar('finTurno cruza medianoche', finTurno('2026-09-09', '22:00', '06:00', TZ).toISOString(), '2026-09-10T04:00:00.000Z')
comprobar('inicioSemana desde miércoles', inicioSemana('2026-09-09'), '2026-09-07')
comprobar('inicioSemana desde domingo', inicioSemana('2026-09-13'), '2026-09-07')
comprobar('formatMinutos', formatMinutos(452), '7 h 32 min')
comprobar('formatMinutos negativo', formatMinutos(-90), '−1 h 30 min')
comprobar('formatHoras', formatHoras(452), '7:32')

console.log('\nJornada normal con pausa')
{
  const js = agruparJornadas(
    [
      f('entrada', '2026-09-08T07:00:00Z'),      // 09:00 local
      f('pausa_inicio', '2026-09-08T11:00:00Z'), // 13:00
      f('pausa_fin', '2026-09-08T12:00:00Z'),    // 14:00
      f('salida', '2026-09-08T16:00:00Z'),       // 18:00
    ],
    new Date('2026-09-09T10:00:00Z'),
    TZ,
  )
  comprobar('una jornada', js.length, 1)
  comprobar('imputada al día de la entrada', js[0].fecha, '2026-09-08')
  comprobar('minutos trabajados', js[0].minutos_trabajados, 480)
  comprobar('minutos de pausa', js[0].minutos_pausa, 60)
  comprobar('sin anomalías', js[0].anomalias, [])
  comprobar('cerrada', js[0].abierta, false)
}

console.log('\nTurno de noche que cruza medianoche')
{
  const js = agruparJornadas(
    [
      f('entrada', '2026-09-08T20:00:00Z'), // 22:00 local del día 8
      f('salida', '2026-09-09T04:00:00Z'),  // 06:00 local del día 9
    ],
    new Date('2026-09-09T10:00:00Z'),
    TZ,
  )
  comprobar('se imputa al día 8', js[0].fecha, '2026-09-08')
  comprobar('8 horas', js[0].minutos_trabajados, 480)
}

console.log('\nJornada abierta')
{
  const abiertaHoy = agruparJornadas(
    [f('entrada', '2026-09-09T07:00:00Z')],
    new Date('2026-09-09T09:30:00Z'),
    TZ,
  )
  comprobar('hoy cuenta el tiempo en curso', abiertaHoy[0].minutos_trabajados, 150)
  comprobar('hoy no es anomalía', abiertaHoy[0].anomalias, [])
  comprobar('marcada abierta', abiertaHoy[0].abierta, true)

  const olvidada = agruparJornadas(
    [f('entrada', '2026-09-07T07:00:00Z')],
    new Date('2026-09-09T09:30:00Z'),
    TZ,
  )
  comprobar('de días pasados es anomalía', olvidada[0].anomalias, ['sin_salida'])
}

console.log('\nEntrada duplicada sin salida')
{
  const js = agruparJornadas(
    [
      f('entrada', '2026-09-08T07:00:00Z'),
      f('entrada', '2026-09-08T13:00:00Z'),
      f('salida', '2026-09-08T16:00:00Z'),
    ],
    new Date('2026-09-09T10:00:00Z'),
    TZ,
  )
  comprobar('dos jornadas', js.length, 2)
  comprobar('la primera queda marcada', js.find((j) => j.anomalias.includes('sin_salida')) !== undefined, true)
}

console.log('\nFichajes anulados y corregidos')
{
  // El responsable anuló la salida de las 15:00 y la corrigió a las 18:00.
  const js = agruparJornadas(
    [
      f('entrada', '2026-09-08T07:00:00Z'),
      f('salida', '2026-09-08T13:00:00Z', {
        anulado_por: 'jefe',
        anulado_en: '2026-09-08T18:30:00Z',
        motivo_anulacion: 'Fichó salida por error',
      }),
      f('salida', '2026-09-08T16:00:00Z', {
        origen: 'manual',
        corrige_a: 'f2',
        nota: 'Fichó salida por error',
      }),
    ],
    new Date('2026-09-09T10:00:00Z'),
    TZ,
  )
  comprobar('una sola jornada', js.length, 1)
  comprobar('cuenta la salida corregida, no la anulada', js[0].minutos_trabajados, 540)
  comprobar('queda marcada como corregida', js[0].anomalias, ['corregido'])
}

console.log('\nAnomalías de ubicación')
{
  const js = agruparJornadas(
    [
      f('entrada', '2026-09-08T07:00:00Z', { dentro_radio: false, distancia_m: 1800 }),
      f('salida', '2026-09-08T15:00:00Z', { lat: null, lon: null, dentro_radio: null, origen: 'manual' }),
    ],
    new Date('2026-09-09T10:00:00Z'),
    TZ,
  )
  comprobar(
    'detecta fuera de radio, sin ubicación y corrección',
    [...js[0].anomalias].sort(),
    ['corregido', 'fuera_de_radio', 'sin_ubicacion'],
  )
}

console.log('\nMinutos de turno')
comprobar('turno de día con pausa', minutosTurno(t('2026-09-09', '09:00', '18:00', 60)), 480)
comprobar('turno de noche', minutosTurno(t('2026-09-09', '22:00', '06:00', 0)), 480)

console.log('\nProyección de turnos')
{
  const desde = '2026-09-07' // lunes
  const hasta = '2026-09-13' // domingo
  comprobar('objetivo semanal de 40 h', objetivoPeriodoMin(40, desde, hasta), 2400)

  // Lunes y martes fichados (8 h cada uno), miércoles a viernes planificados.
  const fichajes = [
    f('entrada', '2026-09-07T07:00:00Z'),
    f('salida', '2026-09-07T15:00:00Z'),
    f('entrada', '2026-09-08T07:00:00Z'),
    f('salida', '2026-09-08T15:00:00Z'),
  ]
  const ahora = new Date('2026-09-09T06:00:00Z') // miércoles 08:00 local
  const jornadas = agruparJornadas(fichajes, ahora, TZ)
  const turnos = [
    t('2026-09-07', '09:00', '17:00'),
    t('2026-09-08', '09:00', '17:00'),
    t('2026-09-09', '09:00', '17:00'),
    t('2026-09-10', '09:00', '17:00'),
    t('2026-09-11', '09:00', '17:00'),
  ]

  const p = proyectar({ jornadas, turnos, horasSemana: 40, desde, hasta, ahora, tz: TZ })
  comprobar('trabajado 16 h', p.trabajado_min, 960)
  comprobar('pendiente 24 h', p.pendiente_min, 1440)
  comprobar('proyectado 40 h', p.proyectado_min, 2400)
  comprobar('cuadra con el objetivo', p.desviacion_min, 0)
  comprobar('no avisa de incumplimiento', p.no_llega, false)
  comprobar('3 turnos pendientes', p.turnos_pendientes, 3)

  // Si le quitamos el viernes, la semana ya no llega.
  const corto = proyectar({
    jornadas,
    turnos: turnos.filter((x) => x.fecha !== '2026-09-11'),
    horasSemana: 40,
    desde,
    hasta,
    ahora,
    tz: TZ,
  })
  comprobar('detecta que no llega', corto.no_llega, true)
  comprobar('faltan 8 h', corto.desviacion_min, -480)
}

console.log('\nTurnos pasados sin fichar')
{
  const ahora = new Date('2026-09-09T06:00:00Z')
  const jornadas = agruparJornadas([f('entrada', '2026-09-07T07:00:00Z'), f('salida', '2026-09-07T15:00:00Z')], ahora, TZ)
  const sinFichar = turnosSinFichar(
    [t('2026-09-07', '09:00', '17:00'), t('2026-09-08', '09:00', '17:00'), t('2026-09-09', '09:00', '17:00')],
    jornadas,
    ahora,
    TZ,
  )
  comprobar('solo el martes', sinFichar.map((x) => x.fecha), ['2026-09-08'])
}

console.log(`\n${total - fallos}/${total} comprobaciones correctas`)
if (fallos > 0) process.exit(1)
