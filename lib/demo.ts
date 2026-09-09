/**
 * Datos de la demo: el reparto real con el que estamos probando.
 * Solo se usan en `/demo`, para poder recorrer la app sin Supabase.
 */
import { TZ } from './constants'
import { hoyLocal, instanteLocal, sumarDias } from './fechas'
import { accesoDeNombre } from './usuario'
import type { Ausencia, Aviso, Centro, Fichaje, Perfil, PlantillaTurno, Turno } from './types'

export const HOY = hoyLocal(TZ)
export const AYER = sumarDias(HOY, -1)
export const ANTEAYER = sumarDias(HOY, -2)

const iso = (fecha: string, hora: string) => instanteLocal(fecha, hora, TZ).toISOString()

/**
 * Los fichajes de hoy van relativos a la hora actual, no a horas fijas: si no,
 * al abrir la demo por la mañana quedarían en el futuro y el siguiente fichaje
 * se ordenaría antes que ellos.
 */
const haceMin = (minutos: number) => new Date(Date.now() - minutos * 60000).toISOString()

const fechaLegible = (fecha: string) => fecha.split('-').reverse().join('/')

// ---------------------------------------------------------------------------
// Centro de trabajo
// ---------------------------------------------------------------------------
export const CENTROS: Centro[] = [
  {
    id: 'skyranch',
    nombre: 'SKYRANCH',
    direccion: 'Calle Logroño, Entrepinos, 28648 Rozas de Puerto Real (Madrid)',
    lat: 40.317603,
    lon: -4.474293,
    // Es una finca, no un local de calle: 500 m, lo medido en el recinto.
    radio_m: 500,
    tz: TZ,
    activo: true,
  },
]

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------
function perfil(
  id: string,
  nombre: string,
  rol: Perfil['rol'],
  horas_semana = 40,
): Perfil {
  return {
    id,
    nombre,
    // Identificador interno derivado del nombre; nadie lo escribe ni lo ve.
    email: accesoDeNombre(nombre),
    rol,
    centro_id: 'skyranch',
    horas_semana,
    dias_vacaciones: 30,
    activo: true,
  }
}

export const ADMIN = perfil('carlos', 'Carlos Raúl', 'admin')

export const PERFILES: Perfil[] = [
  ADMIN,
  perfil('gilenis', 'Gilenis Pérez', 'empleado', 40),
  perfil('gilbert', 'Gilbert Núñez', 'empleado', 40),
  perfil('pedro', 'Pedro Muñoz', 'empleado', 30),
]

export const NOMBRE_POR: Record<string, string> = Object.fromEntries(
  PERFILES.map((p) => [p.id, p.nombre]),
)

// ---------------------------------------------------------------------------
// Fichajes
// ---------------------------------------------------------------------------
let n = 0
function f(
  empleado_id: string,
  tipo: Fichaje['tipo'],
  ts: string,
  extra: Partial<Fichaje> = {},
): Fichaje {
  return {
    id: `fichaje-${++n}`,
    empleado_id,
    centro_id: 'skyranch',
    tipo,
    ts,
    // Dentro del recinto, a unos 19 m del punto del centro.
    lat: 40.317712,
    lon: -4.474118,
    precision_m: 14,
    distancia_m: 19,
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

export const FICHAJES: Fichaje[] = [
  // --- Gilenis: dos días cerrados y hoy trabajando -------------------------
  f('gilenis', 'entrada', iso(ANTEAYER, '09:02')),
  f('gilenis', 'pausa_inicio', iso(ANTEAYER, '13:30')),
  f('gilenis', 'pausa_fin', iso(ANTEAYER, '14:02')),
  f('gilenis', 'salida', iso(ANTEAYER, '17:11')),

  // Ayer fichó la entrada desde el pueblo, a 1,2 km: quedó marcado.
  f('gilenis', 'entrada', iso(AYER, '08:58'), { dentro_radio: false, distancia_m: 1240 }),
  // Y fichó la salida al irse a comer: Carlos la anuló…
  f('gilenis', 'salida', iso(AYER, '13:10'), {
    id: 'gilenis-salida-mala',
    anulado_por: 'carlos',
    anulado_en: iso(AYER, '17:40'),
    motivo_anulacion: 'Fichó salida al irse a comer',
  }),
  // …y puso la hora real.
  f('gilenis', 'salida', iso(AYER, '17:05'), {
    origen: 'manual',
    corrige_a: 'gilenis-salida-mala',
    editado_por: 'carlos',
    editado_en: iso(AYER, '17:40'),
    nota: 'Fichó salida al irse a comer',
    lat: null,
    lon: null,
    precision_m: null,
    distancia_m: null,
    dentro_radio: null,
  }),

  // Hoy: entró hace 2 h 35, con una pausa de 22 min ya cerrada.
  f('gilenis', 'entrada', haceMin(155)),
  f('gilenis', 'pausa_inicio', haceMin(80)),
  f('gilenis', 'pausa_fin', haceMin(58)),

  // --- Gilbert: en pausa ahora mismo ---------------------------------------
  f('gilbert', 'entrada', iso(ANTEAYER, '10:04')),
  f('gilbert', 'salida', iso(ANTEAYER, '18:02')),
  f('gilbert', 'entrada', iso(AYER, '10:00')),
  f('gilbert', 'salida', iso(AYER, '18:06')),
  f('gilbert', 'entrada', haceMin(95)),
  f('gilbert', 'pausa_inicio', haceMin(12)),

  // --- Pedro: ayer y hoy tenía turno y no ha fichado nada -----------------
  f('pedro', 'entrada', iso(ANTEAYER, '08:03')),
  f('pedro', 'salida', iso(ANTEAYER, '14:01')),
]

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------
function t(
  empleado_id: string,
  fecha: string,
  hora_inicio: string,
  hora_fin: string,
  pausa_min = 30,
): Turno {
  return {
    id: `turno-${empleado_id}-${fecha}-${hora_inicio}`,
    empleado_id,
    centro_id: 'skyranch',
    fecha,
    hora_inicio,
    hora_fin,
    pausa_min,
    estado: 'planificado',
    nota: null,
  }
}

/** Horario de cada persona por día de la semana (0 = domingo). */
const HORARIOS: Record<string, { dias: number[]; inicio: string; fin: string; pausa: number }> = {
  gilenis: { dias: [1, 2, 3, 4, 5], inicio: '09:00', fin: '17:30', pausa: 30 },
  gilbert: { dias: [1, 2, 3, 4, 5], inicio: '10:00', fin: '18:30', pausa: 30 },
  pedro: { dias: [1, 3, 5, 6], inicio: '08:00', fin: '14:00', pausa: 0 },
}

/** Del lunes de hace dos semanas al domingo de dentro de cinco. */
function rangoTurnos(): Turno[] {
  const salida: Turno[] = []
  for (let d = -21; d <= 42; d++) {
    const fecha = sumarDias(HOY, d)
    const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay()
    for (const [empleado, h] of Object.entries(HORARIOS)) {
      if (h.dias.includes(dow)) salida.push(t(empleado, fecha, h.inicio, h.fin, h.pausa))
    }
  }
  return salida
}

export const TURNOS: Turno[] = rangoTurnos()

export const PLANTILLAS: PlantillaTurno[] = Object.entries(HORARIOS).flatMap(([empleado, h]) =>
  h.dias.map((dia) => ({
    id: `plantilla-${empleado}-${dia}`,
    empleado_id: empleado,
    centro_id: 'skyranch',
    dia_semana: dia,
    hora_inicio: `${h.inicio}:00`,
    hora_fin: `${h.fin}:00`,
    pausa_min: h.pausa,
    activo: true,
  })),
)

// ---------------------------------------------------------------------------
// Ausencias
// ---------------------------------------------------------------------------
function au(
  empleado_id: string,
  tipo: Ausencia['tipo'],
  desde: string,
  hasta: string,
  estado: Ausencia['estado'],
  motivo: string | null = null,
): Ausencia {
  return {
    id: `ausencia-${empleado_id}-${desde}`,
    empleado_id,
    tipo,
    desde,
    hasta,
    motivo,
    estado,
    justificante: null,
    creado_por: empleado_id,
    creado_en: `${desde}T08:00:00.000Z`,
    decidido_por: estado === 'pendiente' ? null : 'carlos',
    decidido_en: estado === 'pendiente' ? null : `${desde}T09:00:00.000Z`,
    nota_decision: null,
  }
}

const ANIO = HOY.slice(0, 4)

export const AUSENCIAS: Ausencia[] = [
  // Gilbert ya disfrutó una semana en agosto.
  au('gilbert', 'vacaciones', `${ANIO}-08-10`, `${ANIO}-08-16`, 'aprobada'),
  // Gilenis tiene pedida una semana el mes que viene, sin decidir todavía.
  au('gilenis', 'vacaciones', sumarDias(HOY, 24), sumarDias(HOY, 30), 'pendiente', 'Boda de mi hermana'),
  // Pedro estuvo de baja los dos días que aparecían sin fichar.
  au('pedro', 'baja', AYER, HOY, 'aprobada', 'Lumbalgia'),
]

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------
export const AVISOS_ADMIN: Aviso[] = [
  {
    id: 'aviso-fuera',
    empleado_id: 'gilenis',
    destinatario_id: ADMIN.id,
    turno_id: null,
    fichaje_id: 'fichaje-5',
    tipo: 'fichaje_fuera_radio',
    titulo: 'Fichaje fuera del centro',
    cuerpo: 'Gilenis Pérez ha fichado entrada a 1240 m de SKYRANCH.',
    enviado_en: iso(AYER, '08:58'),
    leido_en: null,
  },
  {
    // Pedro está de baja aprobada, así que su turno sin fichar ya no es aviso;
    // lo que espera decisión es la semana de vacaciones que pide Gilenis.
    id: 'aviso-ausencia',
    empleado_id: 'gilenis',
    destinatario_id: ADMIN.id,
    turno_id: null,
    fichaje_id: null,
    tipo: 'ausencia_pendiente',
    titulo: 'Solicitud de ausencia',
    cuerpo: `Gilenis Pérez pide vacaciones del ${fechaLegible(sumarDias(HOY, 24))} al ${fechaLegible(sumarDias(HOY, 30))}.`,
    enviado_en: iso(HOY, '09:10'),
    leido_en: null,
  },
]

/** Avisos que ve la persona trabajadora (Gilenis, en la vista de demo). */
export const AVISOS_EMPLEADO: Aviso[] = [
  {
    id: 'aviso-corregido',
    empleado_id: 'gilenis',
    destinatario_id: 'gilenis',
    turno_id: null,
    fichaje_id: 'fichaje-7',
    tipo: 'fichaje_corregido',
    titulo: 'Un fichaje tuyo ha sido corregido',
    cuerpo: `Tu salida del ${fechaLegible(AYER)} 13:10 pasa a las 17:05. Motivo: Fichó salida al irse a comer`,
    enviado_en: iso(AYER, '17:40'),
    leido_en: null,
  },
]
