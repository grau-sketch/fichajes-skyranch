import Link from 'next/link'
import Formulario from '@/components/Formulario'
import {
  borrarPlantilla,
  cancelarTurno,
  generarTurnos,
  guardarPlantilla,
  guardarTurno,
} from '@/app/actions'
import { DIAS_SEMANA, TZ } from '@/lib/constants'
import { finSemana, formatFechaLarga, formatMinutos, hoyLocal, inicioSemana, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { PlantillaTurno, Perfil, Turno } from '@/lib/types'

export const metadata = { title: 'Planificar turnos' }
export const dynamic = 'force-dynamic'

export default async function PlanificarTurnos({
  searchParams,
}: {
  searchParams: { empleado?: string }
}) {
  await requerirGestor()
  const supabase = createClient()
  const hoy = hoyLocal()

  const { data: perfilesData } = await supabase
    .from('perfiles')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  const perfiles = (perfilesData ?? []) as Perfil[]

  const elegido = perfiles.find((p) => p.id === searchParams.empleado) ?? perfiles[0] ?? null

  const [resPlantillas, resTurnos] = elegido
    ? await Promise.all([
        supabase
          .from('plantillas_turno')
          .select('*')
          .eq('empleado_id', elegido.id)
          .order('dia_semana')
          .order('hora_inicio'),
        supabase
          .from('turnos')
          .select('*')
          .eq('empleado_id', elegido.id)
          .gte('fecha', hoy)
          .lte('fecha', sumarDias(hoy, 42))
          .order('fecha')
          .order('hora_inicio'),
      ])
    : [{ data: [] }, { data: [] }]

  const plantillas = (resPlantillas.data ?? []) as PlantillaTurno[]
  const turnos = (resTurnos.data ?? []) as Turno[]
  const minutosSemanaPatron = plantillas
    .filter((p) => p.activo)
    .reduce((s, p) => s + minutosTurno(p), 0)

  return (
    <>
      <main className="pagina">
        <div className="tarjeta columna">
          <div>
            <label htmlFor="empleado">Empleado</label>
            <form method="get">
              <select id="empleado" name="empleado" defaultValue={elegido?.id ?? ''}>
                {perfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn" style={{ marginTop: 10, width: '100%' }}>
                Cambiar
              </button>
            </form>
          </div>
        </div>

        {!elegido && <p className="vacio">No hay empleados activos</p>}

        {elegido && (
          <>
            <div className="tarjeta">
              <header>
                <div>
                  <h2>Patrón semanal</h2>
                  <p className="mini suave">
                    Contrato {elegido.horas_semana} h · patrón {formatMinutos(minutosSemanaPatron)}
                    {minutosSemanaPatron > 0 &&
                      Math.abs(minutosSemanaPatron - elegido.horas_semana * 60) > 30 &&
                      ' ⚠ no cuadra con el contrato'}
                  </p>
                </div>
              </header>

              {plantillas.length === 0 ? (
                <p className="vacio">Sin patrón definido</p>
              ) : (
                <div className="lista">
                  {plantillas.map((p) => (
                    <div key={p.id} className="item">
                      <span style={{ minWidth: 84, fontWeight: 550 }}>{DIAS_SEMANA[p.dia_semana]}</span>
                      <span className="crece mono pequeno">
                        {p.hora_inicio.slice(0, 5)}–{p.hora_fin.slice(0, 5)}
                        {p.pausa_min > 0 && ` · ${p.pausa_min} min pausa`}
                      </span>
                      <span className="pill mono">{formatMinutos(minutosTurno(p))}</span>
                      <Formulario
                        accion={borrarPlantilla}
                        boton="Quitar"
                        botonClase="btn mini peligro"
                        confirmar="¿Quitar este día del patrón?"
                      >
                        <input type="hidden" name="id" value={p.id} />
                      </Formulario>
                    </div>
                  ))}
                </div>
              )}

              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Añadir día al patrón</summary>
                <div style={{ marginTop: 12 }}>
                  <Formulario accion={guardarPlantilla} boton="Añadir al patrón" limpiarAlEnviar>
                    <input type="hidden" name="empleado_id" value={elegido.id} />
                    <div>
                      <label htmlFor="dia">Día</label>
                      <select id="dia" name="dia_semana" defaultValue="1">
                        {DIAS_SEMANA.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="campos dos">
                      <div>
                        <label htmlFor="hi">Entrada</label>
                        <input id="hi" name="hora_inicio" type="time" required defaultValue="09:00" />
                      </div>
                      <div>
                        <label htmlFor="hf">Salida</label>
                        <input id="hf" name="hora_fin" type="time" required defaultValue="17:00" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="pausa">Pausa (minutos)</label>
                      <input id="pausa" name="pausa_min" type="number" min={0} max={480} defaultValue={30} />
                    </div>
                  </Formulario>
                </div>
              </details>
            </div>

            <div className="tarjeta">
              <header>
                <h2>Generar calendario</h2>
              </header>
              <p className="pequeno suave" style={{ marginBottom: 12 }}>
                Crea los turnos del rango a partir del patrón. No toca los turnos que ya existan.
              </p>
              <Formulario accion={generarTurnos} boton="Generar turnos">
                <input type="hidden" name="empleado_id" value={elegido.id} />
                <div className="campos dos">
                  <div>
                    <label htmlFor="g-desde">Desde</label>
                    <input
                      id="g-desde"
                      name="desde"
                      type="date"
                      required
                      defaultValue={inicioSemana(hoy)}
                    />
                  </div>
                  <div>
                    <label htmlFor="g-hasta">Hasta</label>
                    <input
                      id="g-hasta"
                      name="hasta"
                      type="date"
                      required
                      defaultValue={finSemana(sumarDias(hoy, 28))}
                    />
                  </div>
                </div>
              </Formulario>
            </div>

            <div className="tarjeta">
              <header>
                <h2>Próximas 6 semanas</h2>
                <span className="mini suave mono">
                  {formatMinutos(turnos.reduce((s, t) => s + minutosTurno(t), 0))}
                </span>
              </header>
              {turnos.length === 0 ? (
                <p className="vacio">Sin turnos planificados</p>
              ) : (
                <div className="lista">
                  {turnos.map((t) => (
                    <div key={t.id} className="item">
                      <div className="crece">
                        <p style={{ textTransform: 'capitalize', fontWeight: 550 }}>
                          {formatFechaLarga(t.fecha, TZ)}
                        </p>
                        <p className="mini suave mono">
                          {t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}
                          {t.pausa_min > 0 && ` · ${t.pausa_min} min`}
                        </p>
                      </div>
                      {t.estado === 'cancelado' ? (
                        <span className="pill">Cancelado</span>
                      ) : (
                        <Formulario
                          accion={cancelarTurno}
                          boton="Cancelar"
                          botonClase="btn mini peligro"
                          confirmar="¿Cancelar este turno?"
                        >
                          <input type="hidden" name="id" value={t.id} />
                        </Formulario>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Añadir un turno suelto</summary>
                <div style={{ marginTop: 12 }}>
                  <Formulario accion={guardarTurno} boton="Guardar turno" limpiarAlEnviar>
                    <input type="hidden" name="empleado_id" value={elegido.id} />
                    <div>
                      <label htmlFor="t-fecha">Fecha</label>
                      <input id="t-fecha" name="fecha" type="date" required defaultValue={hoy} />
                    </div>
                    <div className="campos dos">
                      <div>
                        <label htmlFor="t-hi">Entrada</label>
                        <input id="t-hi" name="hora_inicio" type="time" required defaultValue="09:00" />
                      </div>
                      <div>
                        <label htmlFor="t-hf">Salida</label>
                        <input id="t-hf" name="hora_fin" type="time" required defaultValue="17:00" />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="t-pausa">Pausa (minutos)</label>
                      <input id="t-pausa" name="pausa_min" type="number" min={0} max={480} defaultValue={30} />
                    </div>
                  </Formulario>
                </div>
              </details>
            </div>

            <Link className="btn" href={`/admin/informes?empleado=${elegido.id}`}>
              Ver informe de {elegido.nombre.split(' ')[0]}
            </Link>
          </>
        )}
      </main>
    </>
  )
}
