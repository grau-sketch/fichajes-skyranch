import Cabecera from '@/components/Cabecera'
import CalendarioTurnos from '@/components/CalendarioTurnos'
import { TZ } from '@/lib/constants'
import { finSemana, formatMinutos, hoyLocal, inicioSemana, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'
import { requerirPerfil } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Centro, Turno } from '@/lib/types'

export const metadata = { title: 'Mi horario' }
export const dynamic = 'force-dynamic'

export default async function MiHorario() {
  const perfil = await requerirPerfil()
  const supabase = createClient()
  const hoy = hoyLocal()

  // Rango amplio para poder moverse por el calendario sin volver al servidor.
  const [resTurnos, resCentro] = await Promise.all([
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
  ])

  const centro = (resCentro.data ?? null) as Centro | null
  const tz = centro?.tz ?? TZ
  const turnos = (resTurnos.data ?? []) as Turno[]

  const enSemana = (desde: string, hasta: string) =>
    turnos
      .filter((t) => t.estado !== 'cancelado' && t.fecha >= desde && t.fecha <= hasta)
      .reduce((s, t) => s + minutosTurno(t), 0)

  const estaSemana = enSemana(inicioSemana(hoy), finSemana(hoy))
  const proximaSemana = enSemana(
    inicioSemana(sumarDias(hoy, 7)),
    finSemana(sumarDias(hoy, 7)),
  )

  return (
    <>
      <Cabecera titulo="Mi horario" subtitulo={centro?.nombre ?? perfil.nombre} />
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
          <CalendarioTurnos turnos={turnos} tz={tz} />
        </div>

        <p className="mini suave centrado">
          Si algo no cuadra con tu horario, habla con tu responsable.
        </p>
      </main>
    </>
  )
}
