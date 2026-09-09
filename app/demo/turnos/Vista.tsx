'use client'

import CalendarioTurnos from '@/components/CalendarioTurnos'
import { useDemo } from '@/components/DemoProvider'
import { TZ } from '@/lib/constants'
import { HOY } from '@/lib/demo'
import { finSemana, formatMinutos, inicioSemana, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'

export default function Vista() {
  const { estado } = useDemo()
  const yo = estado.perfiles.find((p) => p.id === estado.yo)!
  const centro = estado.centros.find((c) => c.id === yo.centro_id) ?? null
  const turnos = estado.turnos.filter((t) => t.empleado_id === yo.id)

  const enSemana = (desde: string, hasta: string) =>
    turnos
      .filter((t) => t.estado !== 'cancelado' && t.fecha >= desde && t.fecha <= hasta)
      .reduce((s, t) => s + minutosTurno(t), 0)

  const estaSemana = enSemana(inicioSemana(HOY), finSemana(HOY))
  const proximaSemana = enSemana(inicioSemana(sumarDias(HOY, 7)), finSemana(sumarDias(HOY, 7)))

  return (
    <>
      <header className="cabecera">
        <div className="cabecera-inner">
          <div className="crece">
            <h1>Mi horario</h1>
            <p className="quien">{centro?.nombre ?? yo.nombre}</p>
          </div>
        </div>
      </header>

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
            <p className="v mono">{yo.horas_semana} h</p>
            <p className="k">Contrato</p>
          </div>
        </div>

        <div className="tarjeta">
          <CalendarioTurnos turnos={turnos} tz={TZ} />
        </div>

        <p className="mini suave centrado">
          Si algo no cuadra con tu horario, habla con tu responsable.
        </p>
      </main>
    </>
  )
}
