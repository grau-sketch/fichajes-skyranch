import { notFound } from 'next/navigation'
import FichaPersona from '@/components/FichaPersona'
import { resumenVacaciones } from '@/lib/ausencias'
import { TOLERANCIA_DESVIO_MIN, TZ } from '@/lib/constants'
import { finMes, hoyLocal, inicioMes } from '@/lib/fechas'
import { agruparJornadas, desviosDelDia, marcarDesvios, resumirJornadas } from '@/lib/jornada'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Ausencia, Centro, Fichaje, Perfil, Turno } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data } = await supabase.from('perfiles').select('nombre').eq('id', params.id).single()
  return { title: data?.nombre ?? 'Persona' }
}

export default async function Persona({ params }: { params: { id: string } }) {
  const gestor = await requerirGestor()
  const supabase = createClient()
  const hoy = hoyLocal()
  const anio = Number(hoy.slice(0, 4))
  const desdeMes = inicioMes(hoy)
  const hastaMes = finMes(hoy)

  // RLS decide qué se ve: un encargado solo alcanza a la gente de su centro.
  const [resPerfil, resCentros, resAusencias, resFichajes, resTurnos] = await Promise.all([
    supabase.from('perfiles').select('*').eq('id', params.id).single(),
    supabase.from('centros').select('*').order('nombre'),
    supabase
      .from('ausencias')
      .select('*')
      .eq('empleado_id', params.id)
      .gte('hasta', `${anio}-01-01`)
      .order('desde', { ascending: false }),
    supabase
      .from('fichajes')
      .select('*')
      .eq('empleado_id', params.id)
      .gte('ts', `${desdeMes}T00:00:00`)
      .order('ts', { ascending: true }),
    supabase
      .from('turnos')
      .select('*')
      .eq('empleado_id', params.id)
      .gte('fecha', desdeMes)
      .lte('fecha', hastaMes),
  ])

  const persona = resPerfil.data as Perfil | null
  if (!persona) notFound()

  const centros = (resCentros.data ?? []) as Centro[]
  const ausencias = (resAusencias.data ?? []) as Ausencia[]
  const fichajes = (resFichajes.data ?? []) as Fichaje[]
  const turnos = (resTurnos.data ?? []) as Turno[]

  // Con los desvíos marcados, «a revisar» cuenta también las horas que no
  // cuadran con el turno, no solo los fichajes incompletos.
  const jornadas = marcarDesvios(
    agruparJornadas(fichajes, new Date(), TZ).filter(
      (j) => j.fecha >= desdeMes && j.fecha <= hastaMes,
    ),
    turnos,
    TOLERANCIA_DESVIO_MIN,
    TZ,
  )

  return (
    <FichaPersona
      persona={persona}
      centros={centros}
      ausencias={ausencias}
      vacaciones={resumenVacaciones(ausencias, persona.dias_vacaciones, anio)}
      mes={resumirJornadas(jornadas)}
      desvios={desviosDelDia(jornadas, turnos, TOLERANCIA_DESVIO_MIN, TZ)}
      hayTurnos={turnos.length > 0}
      ultimoFichaje={fichajes.length > 0 ? fichajes[fichajes.length - 1].ts : null}
      anio={anio}
      tz={TZ}
      esAdmin={gestor.rol === 'admin'}
    />
  )
}
