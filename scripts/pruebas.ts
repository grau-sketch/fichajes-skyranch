/* Pruebas de la lógica de cálculo. No necesita base de datos.
   Ejecutar:  bun run scripts/pruebas.ts                                  */

import {
  anioSemanaISO,
  finTurno,
  formatHoras,
  formatMinutos,
  inicioSemana,
  instanteLocal,
  numeroSemanaISO,
  rangoSemanaTxt,
} from '../lib/fechas'
import {
  agruparJornadas,
  desviosDelDia,
  esDiaLibre,
  marcarDesvios,
  minutosTurno,
  turnosDeTrabajo,
  turnosSinFichar,
} from '../lib/jornada'
import { objetivoPeriodoMin, proyectar } from '../lib/proyeccion'
import { diasAusenciaEnPeriodo, resumenVacaciones } from '../lib/ausencias'
import type { Ausencia, Fichaje, Turno } from '../lib/types'

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

function t(
  fecha: string,
  hora_inicio: string,
  hora_fin: string,
  pausa_min = 0,
  estado: Turno['estado'] = 'planificado',
): Turno {
  return {
    id: `t${fecha}${hora_inicio}${estado}`,
    empleado_id: 'e1',
    centro_id: 'c1',
    fecha,
    hora_inicio,
    hora_fin,
    pausa_min,
    estado,
    nota: null,
  }
}

/** Día marcado como libre: una fila del día con hora_inicio = hora_fin. */
const libre = (fecha: string) => t(fecha, '00:00', '00:00', 0, 'libre')

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

function a(
  tipo: Ausencia['tipo'],
  desde: string,
  hasta: string,
  estado: Ausencia['estado'] = 'aprobada',
): Ausencia {
  return {
    id: `ausencia-${tipo}-${desde}`,
    empleado_id: 'e1',
    tipo,
    desde,
    hasta,
    motivo: null,
    estado,
    justificante: null,
    creado_por: 'e1',
    creado_en: `${desde}T08:00:00Z`,
    decidido_por: estado === 'pendiente' ? null : 'jefe',
    decidido_en: estado === 'pendiente' ? null : `${desde}T09:00:00Z`,
    nota_decision: null,
  }
}

console.log('\nAusencias: días y vacaciones')
comprobar('días de una ausencia de una semana', diasAusenciaEnPeriodo([a('vacaciones', '2026-09-07', '2026-09-13')], '2026-09-07', '2026-09-13'), 7)
comprobar('solo la parte que cae en el periodo', diasAusenciaEnPeriodo([a('vacaciones', '2026-09-05', '2026-09-09')], '2026-09-07', '2026-09-13'), 3)
comprobar('una solicitud pendiente no descuenta', diasAusenciaEnPeriodo([a('vacaciones', '2026-09-07', '2026-09-13', 'pendiente')], '2026-09-07', '2026-09-13'), 0)
comprobar('una rechazada tampoco', diasAusenciaEnPeriodo([a('vacaciones', '2026-09-07', '2026-09-13', 'rechazada')], '2026-09-07', '2026-09-13'), 0)
comprobar('dos ausencias solapadas no cuentan doble', diasAusenciaEnPeriodo([a('vacaciones', '2026-09-07', '2026-09-10'), a('baja', '2026-09-09', '2026-09-13')], '2026-09-07', '2026-09-13'), 7)
{
  const r = resumenVacaciones(
    [a('vacaciones', '2026-08-01', '2026-08-15'), a('vacaciones', '2026-12-24', '2026-12-31', 'pendiente')],
    30,
    2026,
  )
  comprobar('vacaciones usadas', r.usados, 15)
  comprobar('vacaciones pendientes de aprobar', r.pendientes, 8)
  comprobar('vacaciones restantes', r.restantes, 7)
}

console.log('\nUna semana de vacaciones no es incumplimiento')
{
  const desde = '2026-09-07'
  const hasta = '2026-09-13'
  const ahora = new Date('2026-09-14T06:00:00Z')  // la semana ya pasó
  const turnos = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].map(
    (fecha) => t(fecha, '09:00', '17:00'),
  )
  const vacaciones = [a('vacaciones', desde, hasta)]

  // Sin ausencias: no fichó nada esa semana, así que faltan las 40 h.
  const sin = proyectar({ jornadas: [], turnos, horasSemana: 40, desde, hasta, ahora, tz: TZ })
  comprobar('sin ausencias, objetivo de 40 h', sin.objetivo_min, 2400)
  comprobar('sin ausencias, 5 turnos sin fichar', sin.turnos_sin_fichar, 5)
  comprobar('sin ausencias, no llega', sin.no_llega, true)

  // Con las vacaciones aprobadas: ni objetivo, ni turnos sin fichar.
  const con = proyectar({
    jornadas: [], turnos, horasSemana: 40, desde, hasta, ausencias: vacaciones, ahora, tz: TZ,
  })
  comprobar('con vacaciones, objetivo a cero', con.objetivo_min, 0)
  comprobar('con vacaciones, ningún turno sin fichar', con.turnos_sin_fichar, 0)
  comprobar('con vacaciones, cuadra', con.desviacion_min, 0)
  comprobar('con vacaciones, no avisa de incumplimiento', con.no_llega, false)
  comprobar('cuenta los 7 días de ausencia', con.dias_ausencia, 7)
}

console.log('\nMedia semana de baja')
{
  const desde = '2026-09-07'
  const hasta = '2026-09-13'
  const ahora = new Date('2026-09-14T06:00:00Z')
  // Trabajó lunes y martes; de baja de miércoles a domingo (5 días).
  const fichajes = [
    f('entrada', '2026-09-07T07:00:00Z'), f('salida', '2026-09-07T15:00:00Z'),
    f('entrada', '2026-09-08T07:00:00Z'), f('salida', '2026-09-08T15:00:00Z'),
  ]
  const jornadas = agruparJornadas(fichajes, ahora, TZ)
  const p = proyectar({
    jornadas,
    turnos: ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'].map((x) =>
      t(x, '09:00', '17:00'),
    ),
    horasSemana: 40,
    desde,
    hasta,
    ausencias: [a('baja', '2026-09-09', '2026-09-13')],
    ahora,
    tz: TZ,
  })
  comprobar('objetivo prorrateado a 2 días', p.objetivo_min, Math.round((40 * 60 * 2) / 7))
  comprobar('trabajó 16 h', p.trabajado_min, 960)
  comprobar('los turnos de la baja no salen sin fichar', p.turnos_sin_fichar, 0)
  comprobar('queda por encima del objetivo', p.desviacion_min > 0, true)
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

console.log('\nDesvíos sobre el horario planificado')
{
  // Turno 09:00–17:00 en Madrid (verano = UTC+2).
  const turno = t('2026-09-07', '09:00', '17:00')
  const ahora = new Date('2026-09-09T06:00:00Z')

  const puntual = desviosDelDia(
    agruparJornadas([f('entrada', '2026-09-07T07:05:00Z'), f('salida', '2026-09-07T14:58:00Z')], ahora, TZ),
    [turno],
    10,
    TZ,
  )
  comprobar('dentro del margen no hay desvío', puntual.length, 0)

  const tarde = desviosDelDia(
    agruparJornadas([f('entrada', '2026-09-07T07:35:00Z'), f('salida', '2026-09-07T15:00:00Z')], ahora, TZ),
    [turno],
    10,
    TZ,
  )
  comprobar('entró 35 min tarde', tarde.map((d) => [d.tipo, d.minutos, d.prevista]), [
    ['entrada_tarde', 35, '09:00'],
  ])

  const pronto = desviosDelDia(
    agruparJornadas([f('entrada', '2026-09-07T06:00:00Z'), f('salida', '2026-09-07T13:00:00Z')], ahora, TZ),
    [turno],
    10,
    TZ,
  )
  comprobar('entró y salió antes de hora', pronto.map((d) => d.tipo), [
    'entrada_pronto',
    'salida_pronto',
  ])
  comprobar('una hora de más al entrar', pronto[0].minutos, 60)

  const tardeSalida = desviosDelDia(
    agruparJornadas([f('entrada', '2026-09-07T07:00:00Z'), f('salida', '2026-09-07T16:30:00Z')], ahora, TZ),
    [turno],
    10,
    TZ,
  )
  comprobar('salió 90 min después', tardeSalida.map((d) => [d.tipo, d.minutos]), [
    ['salida_tarde', 90],
  ])

  const sinTurno = desviosDelDia(
    agruparJornadas([f('entrada', '2026-09-07T04:00:00Z'), f('salida', '2026-09-07T13:00:00Z')], ahora, TZ),
    [],
    10,
    TZ,
  )
  comprobar('sin turno no se juzga el horario', sinTurno.length, 0)

  const cancelado = desviosDelDia(
    agruparJornadas([f('entrada', '2026-09-07T04:00:00Z'), f('salida', '2026-09-07T13:00:00Z')], ahora, TZ),
    [{ ...turno, estado: 'cancelado' }],
    10,
    TZ,
  )
  comprobar('un turno cancelado no genera desvío', cancelado.length, 0)

  // Jornada abierta hoy: la entrada sí se juzga, la salida todavía no existe.
  const enCurso = new Date('2026-09-09T12:00:00Z')
  const abierta = desviosDelDia(
    agruparJornadas([f('entrada', '2026-09-09T08:00:00Z')], enCurso, TZ),
    [t('2026-09-09', '09:00', '17:00')],
    10,
    TZ,
  )
  comprobar('solo el desvío de entrada', abierta.map((d) => d.tipo), ['entrada_tarde'])

  // Dos jornadas el mismo día contra un solo turno: un desvío de entrada
  // (la primera) y uno de salida (la última), no cuatro.
  const dosJornadas = desviosDelDia(
    agruparJornadas(
      [
        f('entrada', '2026-09-07T07:40:00Z'),
        f('salida', '2026-09-07T10:00:00Z'),
        f('entrada', '2026-09-07T11:00:00Z'),
        f('salida', '2026-09-07T14:00:00Z'),
      ],
      ahora,
      TZ,
    ),
    [turno],
    10,
    TZ,
  )
  comprobar('dos jornadas, dos desvíos', dosJornadas.map((d) => [d.tipo, d.minutos]), [
    ['entrada_tarde', 40],
    ['salida_pronto', 60],
  ])

  const dosMarcadas = marcarDesvios(
    agruparJornadas(
      [
        f('entrada', '2026-09-07T07:40:00Z'),
        f('salida', '2026-09-07T10:00:00Z'),
        f('entrada', '2026-09-07T11:00:00Z'),
        f('salida', '2026-09-07T14:00:00Z'),
      ],
      ahora,
      TZ,
    ),
    [turno],
    10,
    TZ,
  )
  comprobar(
    'cada anomalía en su jornada',
    dosMarcadas.map((j) => j.anomalias),
    [['entrada_tarde'], ['salida_pronto']],
  )

  const marcadas = marcarDesvios(
    agruparJornadas([f('entrada', '2026-09-07T07:35:00Z'), f('salida', '2026-09-07T15:00:00Z')], ahora, TZ),
    [turno],
    10,
    TZ,
  )
  comprobar('la anomalía llega a la jornada', marcadas[0].anomalias, ['entrada_tarde'])
}

console.log('\nSemana ISO')
{
  comprobar('7 sep 2026 es la semana 37', numeroSemanaISO('2026-09-07'), 37)
  comprobar('el domingo cierra la misma semana', numeroSemanaISO('2026-09-13'), 37)
  comprobar('el lunes siguiente ya es la 38', numeroSemanaISO('2026-09-14'), 38)
  // 1 de enero de 2027 es viernes: pertenece a la semana 53 de 2026.
  comprobar('1 ene 2027 cae en la semana 53', numeroSemanaISO('2027-01-01'), 53)
  comprobar('y su año ISO es 2026', anioSemanaISO('2027-01-01'), 2026)
  comprobar('rango dentro del mes', rangoSemanaTxt('2026-09-07'), 'del 7 al 13 de septiembre')
  comprobar('rango a caballo de dos meses', rangoSemanaTxt('2026-09-28'), 'del 28 sept al 4 de octubre')
}

console.log('\nHorario partido')
{
  const manana = t('2026-09-07', '09:00', '14:00')
  const tarde = t('2026-09-07', '17:00', '20:00')
  comprobar('la mañana son 5 h', minutosTurno(manana), 300)
  comprobar('el día partido son 8 h', minutosTurno(manana) + minutosTurno(tarde), 480)

  const ahora = new Date('2026-09-09T06:00:00Z')
  // Ficha 09:05–14:00 y 17:10–20:00 (Madrid = UTC+2 en septiembre).
  const jornadas = agruparJornadas(
    [
      f('entrada', '2026-09-07T07:05:00Z'),
      f('salida', '2026-09-07T12:00:00Z'),
      f('entrada', '2026-09-07T15:10:00Z'),
      f('salida', '2026-09-07T18:00:00Z'),
    ],
    ahora,
    TZ,
  )
  comprobar('dos jornadas ese día', jornadas.length, 2)
  comprobar(
    'cumpliendo el partido no hay desvío',
    desviosDelDia(jornadas, [manana, tarde], 10, TZ).length,
    0,
  )

  // Se salta la tarde: el cierre del día queda 6 h antes de las 20:00.
  const soloManana = agruparJornadas(
    [f('entrada', '2026-09-07T07:05:00Z'), f('salida', '2026-09-07T12:00:00Z')],
    ahora,
    TZ,
  )
  comprobar(
    'faltar a la tarde sale como salida antes de hora',
    desviosDelDia(soloManana, [manana, tarde], 10, TZ).map((d) => [d.tipo, d.minutos, d.prevista]),
    [['salida_pronto', 360, '20:00']],
  )

  // El orden en que vengan los turnos no puede cambiar el resultado.
  comprobar(
    'da igual el orden de los turnos',
    desviosDelDia(soloManana, [tarde, manana], 10, TZ).map((d) => d.prevista),
    ['20:00'],
  )
}

console.log('\nDías libres')
{
  const ahora = new Date('2026-09-09T06:00:00Z')
  const semana = [
    t('2026-09-07', '09:00', '14:00'),
    t('2026-09-07', '17:00', '20:00'),
    libre('2026-09-08'),
  ]
  comprobar('el libre no es turno de trabajo', turnosDeTrabajo(semana).length, 2)
  comprobar('el día libre se reconoce', esDiaLibre([libre('2026-09-08')]), true)
  comprobar('un día de trabajo no es libre', esDiaLibre([semana[0]]), false)
  comprobar('un día libre no suma minutos', minutosTurno(libre('2026-09-08')), 0)

  const jornadas = agruparJornadas(
    [f('entrada', '2026-09-07T07:00:00Z'), f('salida', '2026-09-07T18:00:00Z')],
    ahora,
    TZ,
  )
  comprobar(
    'un día libre no queda como turno sin fichar',
    turnosSinFichar(semana, jornadas, ahora, TZ).map((x) => x.fecha),
    [],
  )
  comprobar('ni genera desvío de horario', desviosDelDia([], [libre('2026-09-08')], 10, TZ).length, 0)

  const p = proyectar({
    jornadas,
    turnos: semana,
    horasSemana: 40,
    desde: '2026-09-07',
    hasta: '2026-09-08',
    ahora,
    tz: TZ,
  })
  comprobar('el objetivo ignora el día libre', p.turnos_pendientes, 0)
  comprobar('y no cuenta como turno sin fichar', p.turnos_sin_fichar, 0)
}

console.log(`\n${total - fallos}/${total} comprobaciones correctas`)
if (fallos > 0) process.exit(1)
