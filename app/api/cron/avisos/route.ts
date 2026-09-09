import { NextResponse, type NextRequest } from 'next/server'
import { DIAS_RETENCION_UBICACION, TOLERANCIA_ENTRADA_MIN, TOLERANCIA_SALIDA_MIN, TZ } from '@/lib/constants'
import { diasAusentes } from '@/lib/ausencias'
import { finTurno, horaLocal, hoyLocal, instanteLocal, sumarDias } from '@/lib/fechas'
import { agruparJornadas } from '@/lib/jornada'
import { enviarPush, type Suscripcion } from '@/lib/push'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Ausencia, Fichaje, Perfil, Turno } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TipoAviso = 'sin_entrada' | 'jornada_abierta' | 'turno_sin_fichar'

/**
 * Cron de avisos (cada 15 min, ver vercel.json). Tres casos:
 *  · sin_entrada (al trabajador): el turno empezó hace más de la tolerancia y
 *    no ha fichado.
 *  · jornada_abierta (al trabajador): el turno acabó hace rato y sigue abierta.
 *  · turno_sin_fichar (al responsable): el turno terminó sin ningún fichaje.
 * El índice único de `avisos` evita repetir un aviso aunque el cron vuelva a
 * pasar por el mismo turno.
 */
export async function GET(peticion: NextRequest) {
  const secreto = process.env.CRON_SECRET
  const cabecera = peticion.headers.get('authorization')
  if (!secreto || cabecera !== `Bearer ${secreto}`) {
    return new NextResponse('No autorizado', { status: 401 })
  }

  const supabase = createAdminClient()
  const ahora = new Date()
  const hoy = hoyLocal()
  const ayer = sumarDias(hoy, -1)

  const [resTurnos, resFichajes, resPerfiles, resSuscripciones, resAusencias] = await Promise.all([
    supabase.from('turnos').select('*').in('fecha', [ayer, hoy]).neq('estado', 'cancelado'),
    supabase.from('fichajes').select('*').gte('ts', `${sumarDias(ayer, -1)}T00:00:00`),
    supabase.from('perfiles').select('*').eq('activo', true),
    supabase.from('push_suscripciones').select('*'),
    // Quien está de vacaciones o de baja no recibe avisos de fichaje.
    supabase
      .from('ausencias')
      .select('*')
      .eq('estado', 'aprobada')
      .lte('desde', hoy)
      .gte('hasta', ayer),
  ])

  const turnos = (resTurnos.data ?? []) as Turno[]
  const perfiles = new Map(((resPerfiles.data ?? []) as Perfil[]).map((p) => [p.id, p]))
  const suscripcionesPor = new Map<string, Suscripcion[]>()
  for (const s of (resSuscripciones.data ?? []) as (Suscripcion & { empleado_id: string })[]) {
    const lista = suscripcionesPor.get(s.empleado_id) ?? []
    lista.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })
    suscripcionesPor.set(s.empleado_id, lista)
  }

  const ausenciasPor = new Map<string, Ausencia[]>()
  for (const a of (resAusencias.data ?? []) as Ausencia[]) {
    ausenciasPor.set(a.empleado_id, [...(ausenciasPor.get(a.empleado_id) ?? []), a])
  }

  const fichajesPor = new Map<string, Fichaje[]>()
  for (const f of (resFichajes.data ?? []) as Fichaje[]) {
    const lista = fichajesPor.get(f.empleado_id) ?? []
    lista.push(f)
    fichajesPor.set(f.empleado_id, lista)
  }

  const perfilesLista = (resPerfiles.data ?? []) as Perfil[]

  /** Responsables de un empleado: todos los admin y el encargado de su centro. */
  const responsablesDe = (empleadoId: string): string[] => {
    const emp = perfiles.get(empleadoId)
    return perfilesLista
      .filter(
        (p) =>
          p.id !== empleadoId &&
          (p.rol === 'admin' ||
            (p.rol === 'encargado' && emp?.centro_id != null && p.centro_id === emp.centro_id)),
      )
      .map((p) => p.id)
  }

  const pendientes: {
    empleado_id: string
    /** Quién lo recibe. null = el propio empleado. */
    destinatario_id: string | null
    turno_id: string
    tipo: TipoAviso
    titulo: string
    cuerpo: string
  }[] = []

  let saltadosPorAusencia = 0

  for (const t of turnos) {
    const perfil = perfiles.get(t.empleado_id)
    if (!perfil) continue

    // Si ese día tiene una ausencia aprobada, no se espera que fiche.
    if (diasAusentes(ausenciasPor.get(t.empleado_id) ?? [], t.fecha, t.fecha).size > 0) {
      saltadosPorAusencia += 1
      continue
    }

    const jornadas = agruparJornadas(fichajesPor.get(t.empleado_id) ?? [], ahora, TZ)
    const delDia = jornadas.filter((j) => j.fecha === t.fecha)
    const inicio = instanteLocal(t.fecha, t.hora_inicio, TZ)
    const fin = finTurno(t.fecha, t.hora_inicio, t.hora_fin, TZ)

    // ¿Empezó el turno y no hay ni un fichaje ese día?
    if (
      delDia.length === 0 &&
      ahora.getTime() - inicio.getTime() > TOLERANCIA_ENTRADA_MIN * 60000 &&
      ahora < fin
    ) {
      pendientes.push({
        empleado_id: t.empleado_id,
        destinatario_id: null,
        turno_id: t.id,
        tipo: 'sin_entrada',
        titulo: 'Te falta fichar la entrada',
        cuerpo: `Tu turno empezó a las ${t.hora_inicio.slice(0, 5)}. Ficha en cuanto puedas.`,
      })
      continue
    }

    // ¿Terminó el turno sin un solo fichaje? Eso lo tiene que saber el jefe.
    if (delDia.length === 0 && ahora.getTime() - fin.getTime() > TOLERANCIA_SALIDA_MIN * 60000) {
      for (const jefe of responsablesDe(t.empleado_id)) {
        pendientes.push({
          empleado_id: t.empleado_id,
          destinatario_id: jefe,
          turno_id: t.id,
          tipo: 'turno_sin_fichar',
          titulo: 'Turno sin fichar',
          cuerpo: `${perfil.nombre} tenía turno el ${t.fecha} de ${t.hora_inicio.slice(0, 5)} a ${t.hora_fin.slice(0, 5)} y no ha fichado nada.`,
        })
      }
      continue
    }

    // ¿Acabó el turno y la jornada sigue abierta?
    const abierta = delDia.find((j) => j.abierta)
    if (abierta && ahora.getTime() - fin.getTime() > TOLERANCIA_SALIDA_MIN * 60000) {
      pendientes.push({
        empleado_id: t.empleado_id,
        destinatario_id: null,
        turno_id: t.id,
        tipo: 'jornada_abierta',
        titulo: 'Tienes la jornada abierta',
        cuerpo: `Fichaste la entrada a las ${horaLocal(abierta.entrada, TZ)} y no hay salida. Ficha la salida o avisa a tu responsable.`,
      })
    }
  }

  let creados = 0
  let notificados = 0
  const caducados: string[] = []

  for (const p of pendientes) {
    // El índice único (turno_id, tipo) evita repetir el aviso.
    const { error } = await supabase.from('avisos').insert({
      empleado_id: p.empleado_id,
      destinatario_id: p.destinatario_id,
      turno_id: p.turno_id,
      tipo: p.tipo,
      titulo: p.titulo,
      cuerpo: p.cuerpo,
    })
    if (error) continue // ya existía
    creados += 1

    const quien = p.destinatario_id ?? p.empleado_id
    const suscripciones = suscripcionesPor.get(quien) ?? []
    if (suscripciones.length === 0) continue

    const envio = await enviarPush(suscripciones, {
      titulo: p.titulo,
      cuerpo: p.cuerpo,
      url: p.destinatario_id ? '/admin' : '/fichar',
      tag: `${p.tipo}-${p.turno_id}-${quien}`,
    })
    notificados += envio.enviados
    caducados.push(...envio.caducados)
  }

  if (caducados.length > 0) {
    await supabase.from('push_suscripciones').delete().in('endpoint', caducados)
  }

  // Minimización de datos: las coordenadas exactas se borran a los 6 meses; el
  // fichaje y la distancia se conservan los 4 años que exige la ley.
  let ubicacionesPurgadas = 0
  const { data: purgadas } = await supabase.rpc('purgar_ubicaciones', {
    p_dias: DIAS_RETENCION_UBICACION,
  })
  if (typeof purgadas === 'number') ubicacionesPurgadas = purgadas

  return NextResponse.json({
    ok: true,
    momento: ahora.toISOString(),
    turnos_revisados: turnos.length,
    turnos_con_ausencia: saltadosPorAusencia,
    avisos_creados: creados,
    push_enviados: notificados,
    suscripciones_caducadas: caducados.length,
    ubicaciones_purgadas: ubicacionesPurgadas,
  })
}
