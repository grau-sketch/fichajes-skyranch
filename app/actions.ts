'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Rol, TipoAusencia, TipoFichaje } from '@/lib/constants'
import { AUSENCIAS_SOLICITABLES, ROLES, TIPOS_AUSENCIA, TIPOS_FICHAJE } from '@/lib/constants'
import { geocodificar } from '@/lib/geocodificar'
import { notificarAvisosDeFichaje } from '@/lib/notificar'
import { requerirGestor, requerirPerfil } from '@/lib/sesion'
import { accesoDeNombre, nombreValido, usuarioDeNombre } from '@/lib/usuario'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Fichaje } from '@/lib/types'

export type Resultado<T = null> = { ok: true; datos: T } | { ok: false; error: string }

// --- Sesión ------------------------------------------------------------------

export async function entrar(_previo: unknown, form: FormData): Promise<{ error: string } | void> {
  const nombre = String(form.get('nombre') ?? '').trim().replace(/\s+/g, ' ')
  const password = String(form.get('password') ?? '')
  const destino = String(form.get('redirect') ?? '/fichar')

  if (!nombre || !password) return { error: 'Escribe tu nombre y tu contraseña' }
  if (!nombreValido(nombre)) return { error: 'Escribe tu nombre y tu apellido' }

  const supabase = createClient()
  // El identificador se deriva del nombre; nadie usa correo para entrar.
  const { error } = await supabase.auth.signInWithPassword({
    email: accesoDeNombre(nombre),
    password,
  })
  if (error) {
    return {
      error:
        error.message === 'Invalid login credentials'
          ? 'Nombre o contraseña incorrectos. Revisa que escribes tu nombre y apellido igual que te lo dieron.'
          : 'No se ha podido iniciar sesión. Inténtalo de nuevo.',
    }
  }

  redirect(destino.startsWith('/') ? destino : '/fichar')
}

export async function cerrarSesion(): Promise<void> {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// --- Fichar ------------------------------------------------------------------

export async function registrarFichaje(entrada: {
  tipo: TipoFichaje
  lat?: number | null
  lon?: number | null
  precision_m?: number | null
  /** ISO. Solo para fichajes recuperados de la cola offline. */
  ts?: string | null
}): Promise<Resultado<Fichaje>> {
  if (!TIPOS_FICHAJE.includes(entrada.tipo)) {
    return { ok: false, error: 'Tipo de fichaje no válido' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sesión caducada. Vuelve a entrar.' }

  const { data, error } = await supabase.rpc('fichar', {
    p_tipo: entrada.tipo,
    p_lat: entrada.lat ?? null,
    p_lon: entrada.lon ?? null,
    p_precision: entrada.precision_m ?? null,
    p_ts: entrada.ts ?? null,
    p_nota: null,
  })

  if (error) return { ok: false, error: limpiarError(error.message) }

  const fichaje = data as Fichaje

  // Fichar fuera del centro no se bloquea, pero el responsable se entera.
  // fichar() ya dejó el aviso en la base; aquí solo lo empujamos por push.
  if (fichaje.dentro_radio === false) {
    await notificarAvisosDeFichaje(fichaje.id)
  }

  revalidatePath('/fichar')
  revalidatePath('/jornadas')
  revalidatePath('/admin')
  return { ok: true, datos: fichaje }
}

/** Los mensajes de RAISE de PostgreSQL llegan prefijados; los dejamos legibles. */
function limpiarError(mensaje: string): string {
  return mensaje.replace(/^.*?:\s*/, '').trim() || 'No se ha podido registrar el fichaje'
}

// --- Web Push ----------------------------------------------------------------

export async function guardarSuscripcion(suscripcion: {
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string
}): Promise<Resultado> {
  const perfil = await requerirPerfil()
  const supabase = createClient()

  const { error } = await supabase.from('push_suscripciones').upsert(
    {
      empleado_id: perfil.id,
      endpoint: suscripcion.endpoint,
      p256dh: suscripcion.p256dh,
      auth: suscripcion.auth,
      user_agent: suscripcion.user_agent ?? null,
    },
    { onConflict: 'endpoint' },
  )

  if (error) return { ok: false, error: 'No se han podido activar los avisos' }
  return { ok: true, datos: null }
}

export async function borrarSuscripcion(endpoint: string): Promise<Resultado> {
  const perfil = await requerirPerfil()
  const supabase = createClient()
  const { error } = await supabase
    .from('push_suscripciones')
    .delete()
    .eq('endpoint', endpoint)
    .eq('empleado_id', perfil.id)
  if (error) return { ok: false, error: 'No se han podido desactivar los avisos' }
  return { ok: true, datos: null }
}

export async function marcarAvisoLeido(id: string): Promise<Resultado> {
  await requerirPerfil()
  const supabase = createClient()

  // La policy de update ya limita a los avisos dirigidos a quien llama.
  const { error } = await supabase
    .from('avisos')
    .update({ leido_en: new Date().toISOString() })
    .eq('id', id)
    .is('leido_en', null)

  if (error) return { ok: false, error: 'No se ha podido marcar como leído' }

  revalidatePath('/fichar')
  revalidatePath('/admin')
  return { ok: true, datos: null }
}

// --- Correcciones (admin / encargado) ---------------------------------------

export async function corregirFichaje(_previo: unknown, form: FormData) {
  await requerirGestor()
  const empleado_id = String(form.get('empleado_id') ?? '')
  const tipo = String(form.get('tipo') ?? '') as TipoFichaje
  const fecha = String(form.get('fecha') ?? '')
  const hora = String(form.get('hora') ?? '')
  const nota = String(form.get('nota') ?? '')

  if (!empleado_id || !TIPOS_FICHAJE.includes(tipo) || !fecha || !hora) {
    return { error: 'Faltan datos del fichaje' }
  }
  if (nota.trim().length < 3) return { error: 'Indica el motivo de la corrección' }

  const supabase = createClient()
  const { error } = await supabase.rpc('fichaje_manual', {
    p_empleado: empleado_id,
    p_tipo: tipo,
    p_ts: new Date(`${fecha}T${hora}:00`).toISOString(),
    p_nota: nota,
  })
  if (error) return { error: limpiarError(error.message) }

  revalidatePath('/admin')
  revalidatePath('/admin/informes')
  return { ok: 'Fichaje corregido' }
}

export async function anularFichaje(_previo: unknown, form: FormData) {
  await requerirGestor()
  const id = String(form.get('id') ?? '')
  const motivo = String(form.get('motivo') ?? '')
  if (!id) return { error: 'Fichaje no válido' }
  if (motivo.trim().length < 3) return { error: 'Indica el motivo de la anulación' }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('fichaje_anular', {
    p_fichaje: id,
    p_motivo: motivo,
  })
  if (error) return { error: limpiarError(error.message) }

  const anulado = data as Fichaje | null
  if (anulado) await notificarAvisosDeFichaje(anulado.id)

  revalidatePath('/admin')
  revalidatePath('/admin/informes')
  revalidatePath('/jornadas')
  return { ok: 'Fichaje anulado' }
}

export async function corregirHora(_previo: unknown, form: FormData) {
  await requerirGestor()
  const id = String(form.get('id') ?? '')
  const fecha = String(form.get('fecha') ?? '')
  const hora = String(form.get('hora') ?? '')
  const tipo = String(form.get('tipo') ?? '')
  const motivo = String(form.get('motivo') ?? '')

  if (!id || !fecha || !hora) return { error: 'Faltan la fecha y la hora nuevas' }
  if (motivo.trim().length < 3) return { error: 'Indica el motivo de la corrección' }
  if (tipo && !TIPOS_FICHAJE.includes(tipo as TipoFichaje)) {
    return { error: 'Tipo de fichaje no válido' }
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('fichaje_corregir', {
    p_fichaje: id,
    p_nuevo_ts: new Date(`${fecha}T${hora}:00`).toISOString(),
    p_motivo: motivo,
    p_nuevo_tipo: tipo || null,
  })
  if (error) return { error: limpiarError(error.message) }

  const nuevo = data as Fichaje | null
  if (nuevo) await notificarAvisosDeFichaje(nuevo.id)

  revalidatePath('/admin')
  revalidatePath('/admin/informes')
  revalidatePath('/jornadas')
  return { ok: 'Fichaje corregido' }
}

// --- Ausencias: vacaciones, bajas, permisos y faltas ------------------------

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Pide una ausencia. Si la pide la propia persona queda pendiente; si la
 * registra un responsable entra ya aprobada (y la falta solo puede él).
 */
export async function solicitarAusencia(_previo: unknown, form: FormData) {
  await requerirPerfil()

  const tipo = String(form.get('tipo') ?? '') as TipoAusencia
  const desde = String(form.get('desde') ?? '')
  const hasta = String(form.get('hasta') ?? '')
  const motivo = String(form.get('motivo') ?? '')
  const empleado = String(form.get('empleado_id') ?? '')
  const justificante = String(form.get('justificante') ?? '')

  if (!TIPOS_AUSENCIA.includes(tipo)) return { error: 'Tipo de ausencia no válido' }
  if (!FECHA_ISO.test(desde) || !FECHA_ISO.test(hasta)) return { error: 'Indica las fechas' }
  if (hasta < desde) return { error: 'La fecha de fin es anterior a la de inicio' }

  const supabase = createClient()
  const { error } = await supabase.rpc('ausencia_solicitar', {
    p_tipo: tipo,
    p_desde: desde,
    p_hasta: hasta,
    p_motivo: motivo || null,
    p_empleado: empleado || null,
    p_justificante: justificante || null,
  })
  if (error) return { error: limpiarError(error.message) }

  revalidatePath('/turnos')
  revalidatePath('/admin')
  revalidatePath('/admin/ausencias')
  return {
    ok: AUSENCIAS_SOLICITABLES.includes(tipo)
      ? 'Solicitud enviada. Tu responsable la tiene que aprobar.'
      : 'Ausencia registrada',
  }
}

export async function decidirAusencia(_previo: unknown, form: FormData) {
  await requerirPerfil()

  const id = String(form.get('id') ?? '')
  const estado = String(form.get('estado') ?? '')
  const nota = String(form.get('nota') ?? '')

  if (!id) return { error: 'Ausencia no válida' }
  if (!['aprobada', 'rechazada', 'cancelada'].includes(estado)) {
    return { error: 'Decisión no válida' }
  }

  const supabase = createClient()
  const { error } = await supabase.rpc('ausencia_decidir', {
    p_ausencia: id,
    p_estado: estado,
    p_nota: nota || null,
  })
  if (error) return { error: limpiarError(error.message) }

  revalidatePath('/turnos')
  revalidatePath('/admin')
  revalidatePath('/admin/ausencias')
  const etiquetas: Record<string, string> = {
    aprobada: 'Ausencia aprobada',
    rechazada: 'Solicitud rechazada',
    cancelada: 'Solicitud cancelada',
  }
  return { ok: etiquetas[estado] }
}

/**
 * URL temporal para ver un justificante. El bucket es privado: puede contener
 * un parte médico, así que nunca se sirve por enlace permanente.
 */
export async function urlJustificante(ruta: string): Promise<Resultado<string>> {
  await requerirPerfil()
  if (!ruta) return { ok: false, error: 'Sin justificante' }

  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('justificantes')
    .createSignedUrl(ruta, 120)

  if (error || !data?.signedUrl) return { ok: false, error: 'No se ha podido abrir el archivo' }
  return { ok: true, datos: data.signedUrl }
}

// --- Parte de trabajo -------------------------------------------------------

export async function guardarParte(_previo: unknown, form: FormData) {
  await requerirPerfil()
  const fecha = String(form.get('fecha') ?? '')
  const texto = String(form.get('texto') ?? '')

  if (!FECHA_ISO.test(fecha)) return { error: 'Fecha no válida' }
  if (texto.length > 2000) return { error: 'El parte es demasiado largo' }

  const supabase = createClient()
  const { error } = await supabase.rpc('parte_guardar', { p_fecha: fecha, p_texto: texto })
  if (error) return { error: limpiarError(error.message) }

  revalidatePath('/fichar')
  return { ok: texto.trim() ? 'Parte guardado' : 'Parte borrado' }
}

// --- Turnos ------------------------------------------------------------------

export async function guardarPlantilla(_previo: unknown, form: FormData) {
  await requerirGestor()
  const empleado_id = String(form.get('empleado_id') ?? '')
  const dia_semana = Number(form.get('dia_semana'))
  const hora_inicio = String(form.get('hora_inicio') ?? '')
  const hora_fin = String(form.get('hora_fin') ?? '')
  const pausa_min = Number(form.get('pausa_min') ?? 0)

  if (!empleado_id || Number.isNaN(dia_semana) || !hora_inicio || !hora_fin) {
    return { error: 'Faltan datos del patrón' }
  }

  const supabase = createClient()
  const { data: emp } = await supabase
    .from('perfiles')
    .select('centro_id')
    .eq('id', empleado_id)
    .single()

  const { error } = await supabase.from('plantillas_turno').upsert(
    {
      empleado_id,
      centro_id: emp?.centro_id ?? null,
      dia_semana,
      hora_inicio,
      hora_fin,
      pausa_min: Number.isNaN(pausa_min) ? 0 : pausa_min,
    },
    { onConflict: 'empleado_id,dia_semana,hora_inicio' },
  )
  if (error) return { error: 'No se ha podido guardar el patrón' }

  revalidatePath('/admin/turnos')
  return { ok: 'Patrón guardado' }
}

export async function borrarPlantilla(_previo: unknown, form: FormData) {
  await requerirGestor()
  const id = String(form.get('id') ?? '')
  const supabase = createClient()
  const { error } = await supabase.from('plantillas_turno').delete().eq('id', id)
  if (error) return { error: 'No se ha podido borrar' }
  revalidatePath('/admin/turnos')
  return { ok: 'Patrón borrado' }
}

export async function generarTurnos(_previo: unknown, form: FormData) {
  await requerirGestor()
  const empleado_id = String(form.get('empleado_id') ?? '')
  const desde = String(form.get('desde') ?? '')
  const hasta = String(form.get('hasta') ?? '')
  if (!empleado_id || !desde || !hasta) return { error: 'Indica empleado y fechas' }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('generar_turnos', {
    p_empleado: empleado_id,
    p_desde: desde,
    p_hasta: hasta,
  })
  if (error) return { error: limpiarError(error.message) }

  revalidatePath('/admin/turnos')
  revalidatePath('/turnos')
  const n = Number(data ?? 0)
  return { ok: n === 0 ? 'No había turnos nuevos que crear' : `${n} turnos planificados` }
}

export async function guardarTurno(_previo: unknown, form: FormData) {
  await requerirGestor()
  const empleado_id = String(form.get('empleado_id') ?? '')
  const fecha = String(form.get('fecha') ?? '')
  const hora_inicio = String(form.get('hora_inicio') ?? '')
  const hora_fin = String(form.get('hora_fin') ?? '')
  const pausa_min = Number(form.get('pausa_min') ?? 0)
  if (!empleado_id || !fecha || !hora_inicio || !hora_fin) return { error: 'Faltan datos del turno' }

  const supabase = createClient()
  const { data: emp } = await supabase
    .from('perfiles')
    .select('centro_id')
    .eq('id', empleado_id)
    .single()

  const { error } = await supabase.from('turnos').upsert(
    {
      empleado_id,
      centro_id: emp?.centro_id ?? null,
      fecha,
      hora_inicio,
      hora_fin,
      pausa_min: Number.isNaN(pausa_min) ? 0 : pausa_min,
    },
    { onConflict: 'empleado_id,fecha,hora_inicio' },
  )
  if (error) return { error: 'No se ha podido guardar el turno' }

  revalidatePath('/admin/turnos')
  revalidatePath('/turnos')
  return { ok: 'Turno guardado' }
}

export async function cancelarTurno(_previo: unknown, form: FormData) {
  await requerirGestor()
  const id = String(form.get('id') ?? '')
  const supabase = createClient()
  const { error } = await supabase.from('turnos').update({ estado: 'cancelado' }).eq('id', id)
  if (error) return { error: 'No se ha podido cancelar' }
  revalidatePath('/admin/turnos')
  revalidatePath('/turnos')
  return { ok: 'Turno cancelado' }
}

// --- Alta de trabajadores (solo admin) --------------------------------------

/**
 * Crea la cuenta del trabajador y su perfil de una vez, sin pasar por el panel
 * de Supabase. Usa service_role, así que solo puede llamarla un admin: la
 * comprobación de rol es obligatoria aquí, porque el cliente admin salta RLS.
 */
export async function crearEmpleado(_previo: unknown, form: FormData) {
  const gestor = await requerirGestor()
  if (gestor.rol !== 'admin') return { error: 'Solo un administrador puede dar de alta' }

  const nombre = String(form.get('nombre') ?? '').trim().replace(/\s+/g, ' ')
  const password = String(form.get('password') ?? '')
  const rol = String(form.get('rol') ?? 'empleado')
  const centro_id = String(form.get('centro_id') ?? '')
  const horas_semana = Number(form.get('horas_semana') ?? 40)

  if (!nombreValido(nombre)) return { error: 'Escribe el nombre y el apellido' }
  if (password.length < 8) return { error: 'La contraseña necesita al menos 8 caracteres' }

  // Con lo que la persona escribirá para entrar se construye su identificador.
  const email = accesoDeNombre(nombre)
  if (!ROLES.includes(rol as Rol)) return { error: 'Rol no válido' }
  if (Number.isNaN(horas_semana) || horas_semana < 0 || horas_semana > 60) {
    return { error: 'Las horas semanales deben estar entre 0 y 60' }
  }

  let admin: SupabaseClient
  try {
    admin = createAdminClient()
  } catch {
    return {
      error:
        'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Sin ella no se pueden crear cuentas desde la app.',
    }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    // Sin SMTP configurado no habría forma de confirmar el correo.
    email_confirm: true,
    user_metadata: { nombre },
  })

  if (error || !data.user) {
    const yaExiste = /already|exists|registered/i.test(error?.message ?? '')
    return {
      error: yaExiste
        ? `Ya hay alguien dado de alta como "${nombre}". Añade el segundo apellido para diferenciarlos.`
        : 'No se ha podido crear la cuenta',
    }
  }

  // El trigger de auth.users ya creó el perfil; aquí se completan sus datos.
  const { error: errorPerfil } = await admin
    .from('perfiles')
    .update({ nombre, email, rol, centro_id: centro_id || null, horas_semana, activo: true })
    .eq('id', data.user.id)

  if (errorPerfil) {
    return { error: 'La cuenta se creó pero no se han podido guardar sus datos. Revísala en la lista.' }
  }

  revalidatePath('/admin/empleados')
  revalidatePath('/admin')
  return { ok: `${nombre} ya puede entrar escribiendo su nombre y la contraseña que le has dado` }
}

/** Cambia la contraseña de un trabajador (para cuando la pierde). */
/**
 * Traduce un error de Postgres a algo accionable. Se tragaba el mensaje real y
 * un "No se ha podido guardar" a secas no dice si falta una columna, si RLS ha
 * bloqueado la fila o si el dato no pasa un check.
 */
function porQueNoGuarda(error: { message?: string; code?: string } | null): string {
  const m = error?.message ?? ''
  const falta = m.match(/column "?([a-z_]+)"? of relation "?([a-z_]+)"? does not exist/i)
  if (falta) {
    return `A la base de datos le falta la columna "${falta[1]}" en ${falta[2]}. Pasa db/schema.sql por el editor SQL de Supabase y vuelve a intentarlo.`
  }
  if (/does not exist/i.test(m)) {
    return `La base de datos no está al día: ${m}. Pasa db/schema.sql por el editor SQL de Supabase.`
  }
  if (error?.code === '42501' || /row-level security|policy/i.test(m)) {
    return 'La base de datos ha rechazado el cambio por permisos. Comprueba que tu perfil tiene rol admin.'
  }
  return m ? `No se ha podido guardar: ${m}` : 'No se ha podido guardar'
}

export async function restablecerPassword(_previo: unknown, form: FormData) {
  const gestor = await requerirGestor()
  if (gestor.rol !== 'admin') return { error: 'Solo un administrador puede hacer esto' }

  const id = String(form.get('id') ?? '')
  const password = String(form.get('password') ?? '')
  if (!id) return { error: 'Empleado no válido' }
  if (password.length < 8) return { error: 'La contraseña necesita al menos 8 caracteres' }

  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) return { error: 'No se ha podido cambiar la contraseña' }
  } catch {
    return { error: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor' }
  }

  return { ok: 'Contraseña cambiada. Pásasela a la persona.' }
}

/**
 * Ficha completa de una persona: nombre, datos, rol, centro, jornada y
 * vacaciones. Un aviso importante: **cambiar el nombre cambia con qué escribe
 * para entrar**, porque el identificador se deriva de él. Cuando pasa, aquí se
 * actualiza también el correo interno en Auth; si no, esa persona se quedaría
 * fuera sin saber por qué.
 */
export async function guardarPersona(_previo: unknown, form: FormData) {
  const gestor = await requerirGestor()
  if (gestor.rol !== 'admin') return { error: 'Solo un administrador puede cambiar esto' }

  const id = String(form.get('id') ?? '')
  const nombre = String(form.get('nombre') ?? '').trim().replace(/\s+/g, ' ')
  const rol = String(form.get('rol') ?? 'empleado')
  const centro_id = String(form.get('centro_id') ?? '')
  const horas_semana = Number(form.get('horas_semana') ?? 40)
  const dias_vacaciones = Number(form.get('dias_vacaciones') ?? 30)
  const fecha_nacimiento = String(form.get('fecha_nacimiento') ?? '')
  const telefono = String(form.get('telefono') ?? '').trim()
  const activo = form.get('activo') === 'on'

  if (!id) return { error: 'Persona no válida' }
  if (!nombreValido(nombre)) return { error: 'Escribe el nombre y el apellido' }
  if (!ROLES.includes(rol as Rol)) return { error: 'Rol no válido' }
  if (Number.isNaN(horas_semana) || horas_semana < 0 || horas_semana > 60) {
    return { error: 'Las horas semanales deben estar entre 0 y 60' }
  }
  if (Number.isNaN(dias_vacaciones) || dias_vacaciones < 0 || dias_vacaciones > 60) {
    return { error: 'Los días de vacaciones deben estar entre 0 y 60' }
  }
  if (fecha_nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_nacimiento)) {
    return { error: 'La fecha de nacimiento no es válida' }
  }

  const supabase = createClient()
  const { data: actual } = await supabase
    .from('perfiles')
    .select('nombre, email')
    .eq('id', id)
    .single()
  if (!actual) return { error: 'No se encuentra a esa persona' }

  const cambiaNombre = usuarioDeNombre(actual.nombre) !== usuarioDeNombre(nombre)
  let nuevoEmail = actual.email

  // El identificador de acceso se deriva del nombre: si cambia, hay que
  // moverlo también en Auth o esa persona no podría volver a entrar.
  if (cambiaNombre) {
    nuevoEmail = accesoDeNombre(nombre)
    try {
      const admin = createAdminClient()
      const { error } = await admin.auth.admin.updateUserById(id, {
        email: nuevoEmail,
        email_confirm: true,
      })
      if (error) {
        const ocupado = /already|exists|registered/i.test(error.message)
        return {
          error: ocupado
            ? `Ya hay alguien que entra como "${nombre}". Añade el segundo apellido.`
            : 'No se ha podido cambiar el identificador de acceso',
        }
      }
    } catch {
      return {
        error:
          'Para cambiar el nombre hace falta SUPABASE_SERVICE_ROLE_KEY en el servidor: ' +
          'sin ella el acceso quedaría apuntando al nombre antiguo.',
      }
    }
  }

  // `select()` devuelve las filas tocadas: si RLS deja el update en cero filas
  // Postgres no da error, y antes esto respondía "Guardado" sin guardar nada.
  const { data: guardado, error } = await supabase
    .from('perfiles')
    .update({
      nombre,
      email: nuevoEmail,
      rol,
      centro_id: centro_id || null,
      horas_semana,
      dias_vacaciones,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      activo,
    })
    .eq('id', id)
    .select('id')

  if (error) return { error: porQueNoGuarda(error) }
  if (!guardado || guardado.length === 0) {
    return {
      error:
        'La base de datos no ha cambiado ninguna fila. Suele ser que tu perfil no tiene rol admin en la tabla perfiles.',
    }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/personas/${id}`)
  revalidatePath('/admin/empleados')
  return {
    ok: cambiaNombre
      ? `Guardado. Ojo: ${nombre} entra ahora escribiendo ese nombre nuevo.`
      : 'Guardado',
  }
}

// --- Geocodificación de centros ---------------------------------------------

export async function buscarCoordenadas(
  direccion: string,
): Promise<Resultado<{ lat: number; lon: number; etiqueta: string }>> {
  // En producción exige sesión de gestor. En desarrollo se deja abierta para
  // que la pantalla de demostración pueda probar la búsqueda de verdad.
  if (process.env.NODE_ENV === 'production') await requerirGestor()
  const encontrado = await geocodificar(direccion)
  if (!encontrado) {
    return {
      ok: false,
      error: 'No se ha encontrado esa dirección. Prueba con calle, número y ciudad.',
    }
  }
  return { ok: true, datos: encontrado }
}

// --- Plantilla de personal y centros (solo admin) ---------------------------

export async function guardarEmpleado(_previo: unknown, form: FormData) {
  const gestor = await requerirGestor()
  if (gestor.rol !== 'admin') return { error: 'Solo un administrador puede cambiar esto' }

  const id = String(form.get('id') ?? '')
  const centro_id = String(form.get('centro_id') ?? '')
  const rol = String(form.get('rol') ?? 'empleado')
  const horas_semana = Number(form.get('horas_semana') ?? 40)
  const activo = form.get('activo') === 'on'

  if (!id) return { error: 'Empleado no válido' }
  if (Number.isNaN(horas_semana) || horas_semana < 0 || horas_semana > 60) {
    return { error: 'Las horas semanales deben estar entre 0 y 60' }
  }

  const supabase = createClient()
  const { data: guardado, error } = await supabase
    .from('perfiles')
    .update({ centro_id: centro_id || null, rol, horas_semana, activo })
    .eq('id', id)
    .select('id')
  if (error) return { error: porQueNoGuarda(error) }
  if (!guardado || guardado.length === 0) {
    return {
      error:
        'La base de datos no ha cambiado ninguna fila. Suele ser que tu perfil no tiene rol admin en la tabla perfiles.',
    }
  }

  revalidatePath('/admin/empleados')
  revalidatePath('/admin')
  revalidatePath(`/admin/personas/${id}`)
  return { ok: 'Empleado actualizado' }
}

export async function guardarCentro(_previo: unknown, form: FormData) {
  const gestor = await requerirGestor()
  if (gestor.rol !== 'admin') return { error: 'Solo un administrador puede crear centros' }

  const id = String(form.get('id') ?? '')
  const nombre = String(form.get('nombre') ?? '').trim()
  const direccion = String(form.get('direccion') ?? '').trim()
  const lat = form.get('lat') ? Number(form.get('lat')) : null
  const lon = form.get('lon') ? Number(form.get('lon')) : null
  const radio_m = Number(form.get('radio_m') ?? 150)

  if (!nombre) return { error: 'El centro necesita un nombre' }
  if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) return { error: 'Latitud no válida' }
  if (lon !== null && (Number.isNaN(lon) || lon < -180 || lon > 180)) return { error: 'Longitud no válida' }
  if (Number.isNaN(radio_m) || radio_m < 25 || radio_m > 5000) {
    return { error: 'El radio debe estar entre 25 y 5000 metros' }
  }

  const supabase = createClient()
  const fila = { nombre, direccion: direccion || null, lat, lon, radio_m }
  const { error } = id
    ? await supabase.from('centros').update(fila).eq('id', id)
    : await supabase.from('centros').insert(fila)
  if (error) return { error: 'No se ha podido guardar el centro' }

  revalidatePath('/admin/empleados')
  return { ok: 'Centro guardado' }
}
