/**
 * Estado mutable de la demo. Reproduce lo que hacen las funciones de la base
 * (`fichar`, `fichaje_anular`, `fichaje_corregir`, `generar_turnos`…) pero en
 * memoria, para poder tocar la app sin Supabase. Las reglas son las mismas: si
 * aquí no te deja hacer algo, en producción tampoco.
 */
import { SIGUIENTES, TZ, type Rol, type TipoFichaje } from './constants'
import {
  AVISOS_ADMIN,
  AVISOS_EMPLEADO,
  CENTROS,
  FICHAJES,
  PLANTILLAS,
  PERFILES,
  TURNOS,
} from './demo'
import { fechaLocal, horaAMinutos } from './fechas'
import { accesoDeNombre, nombreValido, usuarioDeNombre } from './usuario'
import { distanciaM } from './geo'
import { minutosTurno } from './jornada'
import type { Aviso, Centro, Fichaje, Perfil, PlantillaTurno, Turno } from './types'

export type EstadoDemo = {
  centros: Centro[]
  perfiles: Perfil[]
  fichajes: Fichaje[]
  turnos: Turno[]
  plantillas: PlantillaTurno[]
  avisos: Aviso[]
  /** Quién es "yo" en la vista de trabajadora. */
  yo: string
  /** Quién es "yo" en la vista de administrador. */
  admin: string
}

export type Resultado = { ok: true; estado: EstadoDemo; mensaje?: string } | { ok: false; error: string }

export function estadoInicial(): EstadoDemo {
  return {
    centros: CENTROS.map((c) => ({ ...c })),
    perfiles: PERFILES.map((p) => ({ ...p })),
    fichajes: FICHAJES.map((f) => ({ ...f })),
    turnos: TURNOS.map((t) => ({ ...t })),
    plantillas: PLANTILLAS.map((p) => ({ ...p })),
    avisos: [...AVISOS_ADMIN, ...AVISOS_EMPLEADO].map((a) => ({ ...a })),
    yo: 'gilenis',
    admin: 'carlos',
  }
}

let contador = 0
const id = (prefijo: string) => `${prefijo}-${Date.now().toString(36)}-${++contador}`

function avisoPara(
  destinatario: string,
  empleado: string,
  tipo: Aviso['tipo'],
  titulo: string,
  cuerpo: string,
  fichaje_id: string | null = null,
): Aviso {
  return {
    id: id('aviso'),
    empleado_id: empleado,
    destinatario_id: destinatario,
    turno_id: null,
    fichaje_id,
    tipo,
    titulo,
    cuerpo,
    enviado_en: new Date().toISOString(),
    leido_en: null,
  }
}

/** Responsables de un empleado: los admin y el encargado de su centro. */
function responsablesDe(e: EstadoDemo, empleadoId: string): Perfil[] {
  const emp = e.perfiles.find((p) => p.id === empleadoId)
  return e.perfiles.filter(
    (p) =>
      p.activo &&
      p.id !== empleadoId &&
      (p.rol === 'admin' ||
        (p.rol === 'encargado' && emp?.centro_id != null && p.centro_id === emp.centro_id)),
  )
}

// --- Fichar -----------------------------------------------------------------

export function ficharDemo(
  e: EstadoDemo,
  empleadoId: string,
  tipo: TipoFichaje,
  pos: { lat: number; lon: number; precision_m: number } | null,
): Resultado {
  const emp = e.perfiles.find((p) => p.id === empleadoId)
  if (!emp) return { ok: false, error: 'Empleado no válido' }

  const vigentes = e.fichajes.filter((f) => f.empleado_id === empleadoId && f.anulado_en === null)
  const ultimo = [...vigentes].sort((a, b) => b.ts.localeCompare(a.ts))[0]
  const permitidos = SIGUIENTES[(ultimo?.tipo as TipoFichaje) ?? 'ninguno']
  if (!permitidos.includes(tipo)) {
    return {
      ok: false,
      error: `Movimiento no permitido: "${tipo}" después de "${ultimo?.tipo ?? 'ningún fichaje'}"`,
    }
  }

  const centro = e.centros.find((c) => c.id === emp.centro_id)
  let distancia: number | null = null
  let dentro: boolean | null = null
  if (pos && centro?.lat != null && centro.lon != null) {
    distancia = Math.round(distanciaM(centro.lat, centro.lon, pos.lat, pos.lon) * 10) / 10
    // El margen de error del GPS cuenta a favor de la persona.
    dentro = distancia <= centro.radio_m + Math.min(pos.precision_m, 100)
  }

  const nuevo: Fichaje = {
    id: id('fichaje'),
    empleado_id: empleadoId,
    centro_id: emp.centro_id,
    tipo,
    ts: new Date().toISOString(),
    lat: pos?.lat ?? null,
    lon: pos?.lon ?? null,
    precision_m: pos?.precision_m ?? null,
    distancia_m: distancia,
    dentro_radio: dentro,
    origen: 'app',
    nota: null,
    editado_por: null,
    editado_en: null,
    anulado_por: null,
    anulado_en: null,
    motivo_anulacion: null,
    corrige_a: null,
    creado_en: new Date().toISOString(),
  }

  const avisos = [...e.avisos]
  if (dentro === false) {
    for (const jefe of responsablesDe(e, empleadoId)) {
      avisos.unshift(
        avisoPara(
          jefe.id,
          empleadoId,
          'fichaje_fuera_radio',
          'Fichaje fuera del centro',
          `${emp.nombre} ha fichado ${tipo.replace('_', ' ')} a ${Math.round(distancia!)} m de ${
            centro?.nombre ?? 'su centro'
          }.`,
          nuevo.id,
        ),
      )
    }
  }

  return {
    ok: true,
    estado: { ...e, fichajes: [...e.fichajes, nuevo], avisos },
    mensaje:
      dentro === false
        ? `Registrado a ${Math.round(distancia!)} m del centro. Se ha avisado al responsable.`
        : undefined,
  }
}

// --- Correcciones -----------------------------------------------------------

export function anularDemo(
  e: EstadoDemo,
  fichajeId: string,
  motivo: string,
  porId: string,
): Resultado {
  const f = e.fichajes.find((x) => x.id === fichajeId)
  if (!f) return { ok: false, error: 'El fichaje no existe' }
  if (f.anulado_en !== null) return { ok: false, error: 'Ese fichaje ya estaba anulado' }
  if (motivo.trim().length < 3) return { ok: false, error: 'Anular un fichaje necesita motivo' }

  const anulado: Fichaje = {
    ...f,
    anulado_por: porId,
    anulado_en: new Date().toISOString(),
    motivo_anulacion: motivo.trim(),
  }

  return {
    ok: true,
    estado: {
      ...e,
      fichajes: e.fichajes.map((x) => (x.id === fichajeId ? anulado : x)),
      avisos: [
        avisoPara(
          f.empleado_id,
          f.empleado_id,
          'fichaje_corregido',
          'Un fichaje tuyo ha sido anulado',
          `Se ha anulado tu ${f.tipo.replace('_', ' ')} del ${fechaLocal(f.ts, TZ)}. Motivo: ${motivo.trim()}`,
          f.id,
        ),
        ...e.avisos,
      ],
    },
    mensaje: 'Fichaje anulado',
  }
}

export function corregirDemo(
  e: EstadoDemo,
  fichajeId: string,
  nuevoTs: string,
  nuevoTipo: TipoFichaje,
  motivo: string,
  porId: string,
): Resultado {
  const orig = e.fichajes.find((x) => x.id === fichajeId)
  if (!orig) return { ok: false, error: 'El fichaje no existe' }
  if (orig.anulado_en !== null) {
    return { ok: false, error: 'Ese fichaje está anulado; añade uno nuevo en su lugar' }
  }
  if (motivo.trim().length < 3) return { ok: false, error: 'Una corrección necesita motivo' }
  if (new Date(nuevoTs).getTime() > Date.now() + 120000) {
    return { ok: false, error: 'La hora corregida no puede estar en el futuro' }
  }

  const ahora = new Date().toISOString()
  const anulado: Fichaje = {
    ...orig,
    anulado_por: porId,
    anulado_en: ahora,
    motivo_anulacion: motivo.trim(),
  }
  const sustituto: Fichaje = {
    ...orig,
    id: id('fichaje'),
    tipo: nuevoTipo,
    ts: nuevoTs,
    origen: 'manual',
    nota: motivo.trim(),
    lat: null,
    lon: null,
    precision_m: null,
    distancia_m: null,
    dentro_radio: null,
    editado_por: porId,
    editado_en: ahora,
    anulado_por: null,
    anulado_en: null,
    motivo_anulacion: null,
    corrige_a: orig.id,
    creado_en: ahora,
  }

  return {
    ok: true,
    estado: {
      ...e,
      fichajes: [...e.fichajes.map((x) => (x.id === fichajeId ? anulado : x)), sustituto],
      avisos: [
        avisoPara(
          orig.empleado_id,
          orig.empleado_id,
          'fichaje_corregido',
          'Un fichaje tuyo ha sido corregido',
          `Tu ${orig.tipo.replace('_', ' ')} cambia de hora. Motivo: ${motivo.trim()}`,
          sustituto.id,
        ),
        ...e.avisos,
      ],
    },
    mensaje: 'Fichaje corregido',
  }
}

export function fichajeManualDemo(
  e: EstadoDemo,
  empleadoId: string,
  tipo: TipoFichaje,
  ts: string,
  motivo: string,
  porId: string,
): Resultado {
  if (motivo.trim().length < 3) return { ok: false, error: 'Una corrección manual necesita motivo' }
  const emp = e.perfiles.find((p) => p.id === empleadoId)
  if (!emp) return { ok: false, error: 'Empleado no válido' }

  const ahora = new Date().toISOString()
  const nuevo: Fichaje = {
    id: id('fichaje'),
    empleado_id: empleadoId,
    centro_id: emp.centro_id,
    tipo,
    ts,
    lat: null,
    lon: null,
    precision_m: null,
    distancia_m: null,
    dentro_radio: null,
    origen: 'manual',
    nota: motivo.trim(),
    editado_por: porId,
    editado_en: ahora,
    anulado_por: null,
    anulado_en: null,
    motivo_anulacion: null,
    corrige_a: null,
    creado_en: ahora,
  }

  return {
    ok: true,
    estado: { ...e, fichajes: [...e.fichajes, nuevo] },
    mensaje: 'Fichaje añadido',
  }
}

// --- Avisos -----------------------------------------------------------------

export function marcarAvisoDemo(e: EstadoDemo, avisoId: string): Resultado {
  return {
    ok: true,
    estado: {
      ...e,
      avisos: e.avisos.map((a) =>
        a.id === avisoId ? { ...a, leido_en: new Date().toISOString() } : a,
      ),
    },
  }
}

// --- Centros ----------------------------------------------------------------

export function guardarCentroDemo(
  e: EstadoDemo,
  datos: {
    id?: string
    nombre: string
    direccion: string
    lat: number | null
    lon: number | null
    radio_m: number
  },
): Resultado {
  if (datos.nombre.trim().length < 2) return { ok: false, error: 'El centro necesita un nombre' }
  if (datos.radio_m < 25 || datos.radio_m > 5000) {
    return { ok: false, error: 'El radio debe estar entre 25 y 5000 metros' }
  }

  if (datos.id) {
    return {
      ok: true,
      estado: {
        ...e,
        centros: e.centros.map((c) =>
          c.id === datos.id
            ? {
                ...c,
                nombre: datos.nombre.trim(),
                direccion: datos.direccion.trim() || null,
                lat: datos.lat,
                lon: datos.lon,
                radio_m: datos.radio_m,
              }
            : c,
        ),
      },
      mensaje: 'Centro guardado',
    }
  }

  const nuevo: Centro = {
    id: id('centro'),
    nombre: datos.nombre.trim(),
    direccion: datos.direccion.trim() || null,
    lat: datos.lat,
    lon: datos.lon,
    radio_m: datos.radio_m,
    tz: TZ,
    activo: true,
  }
  return {
    ok: true,
    estado: { ...e, centros: [...e.centros, nuevo] },
    mensaje: `${nuevo.nombre} creado`,
  }
}

// --- Personal ---------------------------------------------------------------

export function crearEmpleadoDemo(
  e: EstadoDemo,
  datos: {
    nombre: string
    password: string
    rol: Rol
    centro_id: string
    horas_semana: number
  },
): Resultado {
  const nombre = datos.nombre.trim().replace(/\s+/g, ' ')
  if (!nombreValido(nombre)) return { ok: false, error: 'Escribe el nombre y el apellido' }
  if (datos.password.length < 8) {
    return { ok: false, error: 'La contraseña necesita al menos 8 caracteres' }
  }
  // Dos personas con el mismo nombre entrarían con el mismo identificador.
  if (e.perfiles.some((p) => usuarioDeNombre(p.nombre) === usuarioDeNombre(nombre))) {
    return {
      ok: false,
      error: `Ya hay alguien dado de alta como "${nombre}". Añade el segundo apellido para diferenciarlos.`,
    }
  }
  if (datos.horas_semana < 0 || datos.horas_semana > 60) {
    return { ok: false, error: 'Las horas semanales deben estar entre 0 y 60' }
  }

  const nuevo: Perfil = {
    id: id('perfil'),
    nombre,
    email: accesoDeNombre(nombre),
    rol: datos.rol,
    centro_id: datos.centro_id || null,
    horas_semana: datos.horas_semana,
    activo: true,
  }
  return {
    ok: true,
    estado: { ...e, perfiles: [...e.perfiles, nuevo] },
    mensaje: `${nuevo.nombre} ya puede entrar escribiendo su nombre y la contraseña que le has dado`,
  }
}

export function guardarEmpleadoDemo(
  e: EstadoDemo,
  datos: {
    id: string
    rol: Rol
    centro_id: string
    horas_semana: number
    activo: boolean
  },
): Resultado {
  if (datos.horas_semana < 0 || datos.horas_semana > 60) {
    return { ok: false, error: 'Las horas semanales deben estar entre 0 y 60' }
  }
  return {
    ok: true,
    estado: {
      ...e,
      perfiles: e.perfiles.map((p) =>
        p.id === datos.id
          ? {
              ...p,
              rol: datos.rol,
              centro_id: datos.centro_id || null,
              horas_semana: datos.horas_semana,
              activo: datos.activo,
            }
          : p,
      ),
    },
    mensaje: 'Empleado actualizado',
  }
}

// --- Turnos -----------------------------------------------------------------

export function guardarPlantillaDemo(
  e: EstadoDemo,
  datos: {
    empleado_id: string
    dia_semana: number
    hora_inicio: string
    hora_fin: string
    pausa_min: number
  },
): Resultado {
  if (!datos.hora_inicio || !datos.hora_fin) return { ok: false, error: 'Faltan las horas' }
  const existe = e.plantillas.some(
    (p) =>
      p.empleado_id === datos.empleado_id &&
      p.dia_semana === datos.dia_semana &&
      p.hora_inicio.slice(0, 5) === datos.hora_inicio,
  )
  if (existe) return { ok: false, error: 'Ya hay un turno a esa hora ese día' }

  const nueva: PlantillaTurno = {
    id: id('plantilla'),
    empleado_id: datos.empleado_id,
    centro_id: e.perfiles.find((p) => p.id === datos.empleado_id)?.centro_id ?? null,
    dia_semana: datos.dia_semana,
    hora_inicio: `${datos.hora_inicio}:00`,
    hora_fin: `${datos.hora_fin}:00`,
    pausa_min: datos.pausa_min,
    activo: true,
  }
  return {
    ok: true,
    estado: { ...e, plantillas: [...e.plantillas, nueva] },
    mensaje: 'Patrón guardado',
  }
}

export function borrarPlantillaDemo(e: EstadoDemo, plantillaId: string): Resultado {
  return {
    ok: true,
    estado: { ...e, plantillas: e.plantillas.filter((p) => p.id !== plantillaId) },
    mensaje: 'Patrón borrado',
  }
}

export function generarTurnosDemo(
  e: EstadoDemo,
  empleadoId: string,
  desde: string,
  hasta: string,
): Resultado {
  if (!desde || !hasta || hasta < desde) return { ok: false, error: 'Rango de fechas no válido' }

  const suyas = e.plantillas.filter((p) => p.empleado_id === empleadoId && p.activo)
  if (suyas.length === 0) return { ok: false, error: 'Este empleado no tiene patrón semanal' }

  const nuevos: Turno[] = []
  const cursor = new Date(`${desde}T00:00:00Z`)
  const fin = new Date(`${hasta}T00:00:00Z`)

  while (cursor <= fin) {
    const fecha = cursor.toISOString().slice(0, 10)
    const dow = cursor.getUTCDay()
    for (const p of suyas.filter((x) => x.dia_semana === dow)) {
      const yaExiste = e.turnos.some(
        (t) =>
          t.empleado_id === empleadoId &&
          t.fecha === fecha &&
          t.hora_inicio.slice(0, 5) === p.hora_inicio.slice(0, 5),
      )
      if (!yaExiste) {
        nuevos.push({
          id: id('turno'),
          empleado_id: empleadoId,
          centro_id: p.centro_id,
          fecha,
          hora_inicio: p.hora_inicio,
          hora_fin: p.hora_fin,
          pausa_min: p.pausa_min,
          estado: 'planificado',
          nota: null,
        })
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return {
    ok: true,
    estado: { ...e, turnos: [...e.turnos, ...nuevos] },
    mensaje:
      nuevos.length === 0
        ? 'No había turnos nuevos que crear'
        : `${nuevos.length} turnos planificados (${Math.round(
            nuevos.reduce((s, t) => s + minutosTurno(t), 0) / 60,
          )} h)`,
  }
}

export function guardarTurnoDemo(
  e: EstadoDemo,
  datos: {
    empleado_id: string
    fecha: string
    hora_inicio: string
    hora_fin: string
    pausa_min: number
  },
): Resultado {
  if (!datos.fecha || !datos.hora_inicio || !datos.hora_fin) {
    return { ok: false, error: 'Faltan datos del turno' }
  }
  if (
    horaAMinutos(datos.hora_fin) === horaAMinutos(datos.hora_inicio)
  ) {
    return { ok: false, error: 'La entrada y la salida no pueden ser la misma hora' }
  }
  if (
    e.turnos.some(
      (t) =>
        t.empleado_id === datos.empleado_id &&
        t.fecha === datos.fecha &&
        t.hora_inicio.slice(0, 5) === datos.hora_inicio,
    )
  ) {
    return { ok: false, error: 'Ya hay un turno ese día a esa hora' }
  }

  const nuevo: Turno = {
    id: id('turno'),
    empleado_id: datos.empleado_id,
    centro_id: e.perfiles.find((p) => p.id === datos.empleado_id)?.centro_id ?? null,
    fecha: datos.fecha,
    hora_inicio: `${datos.hora_inicio}:00`,
    hora_fin: `${datos.hora_fin}:00`,
    pausa_min: datos.pausa_min,
    estado: 'planificado',
    nota: null,
  }
  return { ok: true, estado: { ...e, turnos: [...e.turnos, nuevo] }, mensaje: 'Turno guardado' }
}

export function cancelarTurnoDemo(e: EstadoDemo, turnoId: string): Resultado {
  return {
    ok: true,
    estado: {
      ...e,
      turnos: e.turnos.map((t) => (t.id === turnoId ? { ...t, estado: 'cancelado' } : t)),
    },
    mensaje: 'Turno cancelado',
  }
}
