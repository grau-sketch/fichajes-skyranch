'use client'

import Marca from '@/components/Marca'
import CalendarioTurnos from '@/components/CalendarioTurnos'
import { useDemo } from '@/components/DemoProvider'
import ListaAusencias from '@/components/ListaAusencias'
import PedirAusencia from '@/components/PedirAusencia'
import { TZ } from '@/lib/constants'
import { HOY } from '@/lib/demo'
import { resumenVacaciones } from '@/lib/ausencias'
import { decidirAusenciaDemo, solicitarAusenciaDemo } from '@/lib/demoEstado'
import { finSemana, formatMinutos, inicioSemana, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const yo = estado.perfiles.find((p) => p.id === estado.yo)!
  const anio = Number(HOY.slice(0, 4))
  const misAusencias = estado.ausencias.filter((a) => a.empleado_id === yo.id)
  const vacaciones = resumenVacaciones(misAusencias, yo.dias_vacaciones, anio)
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
            <Marca />
            <h1>Mi horario</h1>
            <p className="quien">{yo.nombre}</p>
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
          <CalendarioTurnos turnos={turnos} ausencias={misAusencias} tz={TZ} />
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
          <ListaAusencias
            ausencias={misAusencias}
            yo={yo.id}
            demo={{
              decidir: (form) =>
                aplicar((e) =>
                  decidirAusenciaDemo(
                    e,
                    String(form.get('id')),
                    String(form.get('estado')) as 'aprobada' | 'rechazada' | 'cancelada',
                    String(form.get('nota') ?? ''),
                    e.yo,
                  ),
                ),
            }}
          />

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Pedir una ausencia</summary>
            <div style={{ marginTop: 14 }}>
              <PedirAusencia
                empleadoId={yo.id}
                demo={(form) =>
                  aplicar((e) =>
                    solicitarAusenciaDemo(e, {
                      empleado_id: e.yo,
                      tipo: String(form.get('tipo')) as 'vacaciones',
                      desde: String(form.get('desde')),
                      hasta: String(form.get('hasta')),
                      motivo: String(form.get('motivo') ?? ''),
                      justificante: String(form.get('justificante') ?? '') || null,
                      comoGestor: false,
                    }),
                  )
                }
              />
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
