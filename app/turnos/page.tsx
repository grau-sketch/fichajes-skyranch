import Cabecera from '@/components/Cabecera'
import CalendarioTurnos from '@/components/CalendarioTurnos'
import ListaAusencias from '@/components/ListaAusencias'
import PedirAusencia from '@/components/PedirAusencia'
import { TZ } from '@/lib/constants'
import { resumenVacaciones } from '@/lib/ausencias'
import { finSemana, formatMinutos, hoyLocal, inicioSemana, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'
import { requerirPerfil } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Ausencia, Centro, Turno } from '@/lib/types'

export const metadata = { title: 'Mi horario' }
export const dynamic = 'force-dynamic'

export default async function MiHorario() {
  const perfil = await requerirPerfil()
  const supabase = createClient()
  const hoy = hoyLocal()
  const anio = Number(hoy.slice(0, 4))

  const [resTurnos, resCentro, resAusencias] = await Promise.all([
    supabase
      .from('turnos')
      .select('*')
      .eq('empleado_id', perfil.id)
      .gte('fecha', sumarDias(hoy, -60))
      .lte('fecha', sumarDias(hoy, 120))
      .order('fecha')
      .order('hora_inicio'),
    perfil.centro_id
      ? supabase.from('centros').select('*').eq('id', perfil.centro_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('ausencias')
      .select('*')
      .eq('empleado_id', perfil.id)
      .gte('hasta', `${anio}-01-01`)
      .order('desde', { ascending: false }),
  ])

  const centro = (resCentro.data ?? null) as Centro | null
  const tz = centro?.tz ?? TZ
  const turnos = (resTurnos.data ?? []) as Turno[]
  const ausencias = (resAusencias.data ?? []) as Ausencia[]
  const vacaciones = resumenVacaciones(ausencias, perfil.dias_vacaciones, anio)

  const enSemana = (desde: string, hasta: string) =>
    turnos
      .filter((t) => t.estado !== 'cancelado' && t.fecha >= desde && t.fecha <= hasta)
      .reduce((s, t) => s + minutosTurno(t), 0)

  const estaSemana = enSemana(inicioSemana(hoy), finSemana(hoy))
  const proximaSemana = enSemana(inicioSemana(sumarDias(hoy, 7)), finSemana(sumarDias(hoy, 7)))

  return (
    <>
      <Cabecera titulo="Mi horario" subtitulo={perfil.nombre} />
      <main className="pagina">
        <div className="metricas">
          <div>
            <p className="v mono">{formatMinutos(estaSemana)}</p>
            <p className="k">Esta semana</p>
          </div>
          <div>
            <p className="v mono">{formatMinutos(proximaSemana)}</p>
            <p className="k">Próxima semana</p>
          </div>
          <div>
            <p className="v mono">{perfil.horas_semana} h</p>
            <p className="k">Contrato</p>
          </div>
        </div>

        <div className="tarjeta">
          <CalendarioTurnos turnos={turnos} ausencias={ausencias} tz={tz} />
        </div>

        <div className="tarjeta">
          <header>
            <h2>Mis vacaciones {anio}</h2>
            <span className="pill marca mono">{vacaciones.restantes} días libres</span>
          </header>
          <div className="metricas" style={{ boxShadow: 'none' }}>
            <div>
              <p className="v mono">{vacaciones.total}</p>
              <p className="k">Del año</p>
            </div>
            <div>
              <p className="v mono">{vacaciones.usados}</p>
              <p className="k">Disfrutados</p>
            </div>
            <div>
              <p className="v mono">{vacaciones.pendientes}</p>
              <p className="k">Por aprobar</p>
            </div>
          </div>
        </div>

        <div className="tarjeta">
          <header>
            <h2>Ausencias</h2>
          </header>
          <ListaAusencias ausencias={ausencias} yo={perfil.id} />

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Pedir una ausencia</summary>
            <div style={{ marginTop: 14 }}>
              <PedirAusencia empleadoId={perfil.id} />
            </div>
          </details>
        </div>

        <p className="mini suave centrado">
          Si algo no cuadra con tu horario, habla con tu responsable.
        </p>
      </main>
    </>
  )
}
