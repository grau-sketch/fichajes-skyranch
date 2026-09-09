import PanelEquipo, { type FilaEquipo } from '@/components/PanelEquipo'
import { TOLERANCIA_ENTRADA_MIN, TOLERANCIA_SALIDA_MIN, TZ } from '@/lib/constants'
import { finTurno, hoyLocal, instanteLocal, sumarDias } from '@/lib/fechas'
import { agruparJornadas } from '@/lib/jornada'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { diasAusentes } from '@/lib/ausencias'
import type { Ausencia, Aviso, EstadoActual, Fichaje, Perfil, Turno } from '@/lib/types'

export const metadata = { title: 'Equipo' }
export const dynamic = 'force-dynamic'

export default async function Admin() {
  const gestor = await requerirGestor()
  const supabase = createClient()
  const hoy = hoyLocal()
  const ahora = new Date()

  // RLS ya limita el alcance: admin ve todo, encargado solo su centro.
  const [resPerfiles, resEstado, resFichajes, resTurnos, resAvisos, resAusencias] =
    await Promise.all([
    supabase.from('perfiles').select('*').eq('activo', true).order('nombre'),
    supabase.from('estado_actual').select('*').order('nombre'),
    supabase
      .from('fichajes')
      .select('*')
      .gte('ts', `${sumarDias(hoy, -1)}T00:00:00`)
      .order('ts', { ascending: true }),
    supabase.from('turnos').select('*').eq('fecha', hoy).neq('estado', 'cancelado'),
    supabase
      .from('avisos')
      .select('*')
      .eq('destinatario_id', gestor.id)
      .is('leido_en', null)
      .order('enviado_en', { ascending: false })
      .limit(15),
    supabase
      .from('ausencias')
      .select('*')
      .in('estado', ['pendiente', 'aprobada'])
      .gte('hasta', sumarDias(hoy, -1)),
    ])

  const perfiles = (resPerfiles.data ?? []) as Perfil[]
  const estados = (resEstado.data ?? []) as EstadoActual[]
  const fichajes = (resFichajes.data ?? []) as Fichaje[]
  const turnos = (resTurnos.data ?? []) as Turno[]
  const avisos = (resAvisos.data ?? []) as Aviso[]
  const ausencias = (resAusencias.data ?? []) as Ausencia[]
  const ausenciasPendientes = ausencias.filter((a) => a.estado === 'pendiente').length

  const porEmpleado = new Map<string, Fichaje[]>()
  for (const f of fichajes) {
    const lista = porEmpleado.get(f.empleado_id) ?? []
    lista.push(f)
    porEmpleado.set(f.empleado_id, lista)
  }

  const filas: FilaEquipo[] = perfiles.map((p) => {
    const jornadas = agruparJornadas(porEmpleado.get(p.id) ?? [], ahora, TZ)
    const estado = estados.find((e) => e.empleado_id === p.id)
    const turnosHoy = turnos
      .filter((t) => t.empleado_id === p.id)
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    const deHoy = jornadas.filter((j) => j.fecha === hoy)

    const deAusencia =
      diasAusentes(
        ausencias.filter((a) => a.empleado_id === p.id),
        hoy,
        hoy,
      ).size > 0

    const primerTurno = turnosHoy[0]
    const sinEntrada =
      primerTurno &&
      !deAusencia &&
      deHoy.length === 0 &&
      ahora.getTime() - instanteLocal(hoy, primerTurno.hora_inicio, TZ).getTime() >
        TOLERANCIA_ENTRADA_MIN * 60000

    const ultimoTurno = turnosHoy[turnosHoy.length - 1]
    const jornadaColgada =
      jornadas.find((j) => j.abierta && j.fecha !== hoy) ??
      (ultimoTurno &&
      deHoy.some((j) => j.abierta) &&
      ahora.getTime() - finTurno(hoy, ultimoTurno.hora_inicio, ultimoTurno.hora_fin, TZ).getTime() >
        TOLERANCIA_SALIDA_MIN * 60000
        ? deHoy.find((j) => j.abierta)
        : undefined)

    const fueraDeRadio = (porEmpleado.get(p.id) ?? []).some(
      (f) => f.dentro_radio === false && f.ts >= `${hoy}T00:00:00`,
    )

    return {
      id: p.id,
      nombre: p.nombre,
      estado: estado?.estado ?? 'fuera',
      ultimoTs: estado?.ultimo_ts ?? null,
      minutosHoy: deHoy.reduce((s, j) => s + j.minutos_trabajados, 0),
      turnosHoy,
      sinEntrada: Boolean(sinEntrada),
      jornadaColgada: jornadaColgada ?? null,
      fueraDeRadio,
    }
  })

  return (
    <main className="pagina">
      <PanelEquipo
        filas={filas}
        avisos={avisos}
        hoy={hoy}
        tz={TZ}
        esAdmin={gestor.rol === 'admin'}
        ausenciasPendientes={ausenciasPendientes}
      />
    </main>
  )
}
