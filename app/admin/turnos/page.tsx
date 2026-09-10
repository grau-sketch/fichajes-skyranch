import Link from 'next/link'
import Formulario from '@/components/Formulario'
import PlanificadorSemana from '@/components/PlanificadorSemana'
import { borrarPlantilla, generarTurnos, guardarPlantilla } from '@/app/actions'
import { DIAS_SEMANA } from '@/lib/constants'
import {
  finSemana,
  formatMinutos,
  hoyLocal,
  inicioSemana,
  numeroSemanaISO,
  rangoSemanaTxt,
  sumarDias,
} from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Ausencia, PlantillaTurno, Perfil, Turno } from '@/lib/types'

export const metadata = { title: 'Planificar turnos' }
export const dynamic = 'force-dynamic'

export default async function PlanificarTurnos({
  searchParams,
}: {
  searchParams: { empleado?: string; semana?: string }
}) {
  await requerirGestor()
  const supabase = createClient()
  const hoy = hoyLocal()

  // La semana siempre empieza en lunes, venga como venga en la URL.
  const semana = inicioSemana(
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams.semana ?? '') ? searchParams.semana! : hoy,
  )

  const { data: perfilesData } = await supabase
    .from('perfiles')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  // El administrador no ficha, así que tampoco tiene horario que planificar.
  const perfiles = (perfilesData ?? []).filter((p) => (p as Perfil).rol !== 'admin') as Perfil[]

  const elegido = perfiles.find((p) => p.id === searchParams.empleado) ?? perfiles[0] ?? null

  const [resTurnos, resPlantillas, resAusencias] = elegido
    ? await Promise.all([
        supabase
          .from('turnos')
          .select('*')
          .eq('empleado_id', elegido.id)
          .gte('fecha', sumarDias(semana, -7))
          .lte('fecha', sumarDias(semana, 13))
          .order('fecha')
          .order('hora_inicio'),
        supabase
          .from('plantillas_turno')
          .select('*')
          .eq('empleado_id', elegido.id)
          .order('dia_semana')
          .order('hora_inicio'),
        supabase
          .from('ausencias')
          .select('*')
          .eq('empleado_id', elegido.id)
          .eq('estado', 'aprobada')
          .gte('hasta', semana)
          .lte('desde', sumarDias(semana, 6)),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const todos = (resTurnos.data ?? []) as Turno[]
  const plantillas = (resPlantillas.data ?? []) as PlantillaTurno[]
  const ausencias = (resAusencias.data ?? []) as Ausencia[]

  const finDeSemana = sumarDias(semana, 6)
  const deLaSemana = todos.filter((t) => t.fecha >= semana && t.fecha <= finDeSemana)

  const minutosSemanaPatron = plantillas
    .filter((p) => p.activo)
    .reduce((s, p) => s + minutosTurno(p), 0)

  // Un vistazo a las tres semanas de alrededor, para no navegar a ciegas.
  const vecinas = [-7, 0, 7, 14].map((salto) => {
    const inicio = sumarDias(semana, salto)
    const fin = sumarDias(inicio, 6)
    const suyos = todos.filter((t) => t.fecha >= inicio && t.fecha <= fin)
    return {
      inicio,
      minutos: suyos.reduce((s, t) => s + minutosTurno(t), 0),
      libres: suyos.filter((t) => t.estado === 'libre').length,
      vacia: suyos.length === 0,
    }
  })

  return (
    <main className="pagina">
      {perfiles.length === 0 ? (
        <p className="vacio">
          No hay trabajadores activos. Créalos en Personal y centros y vuelve aquí.
        </p>
      ) : (
        <>
          <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
            {perfiles.map((p) => (
              <Link
                key={p.id}
                href={`/admin/turnos?empleado=${p.id}&semana=${semana}`}
                className={`btn${p.id === elegido?.id ? ' primario' : ''}`}
              >
                {p.nombre.split(' ')[0]}
              </Link>
            ))}
          </div>

          {elegido && (
            <>
              <PlanificadorSemana
                key={`${elegido.id}-${semana}`}
                empleado={elegido}
                semana={semana}
                turnos={deLaSemana}
                ausencias={ausencias}
                hoy={hoy}
              />

              <div className="tarjeta">
                <header>
                  <h2>De un vistazo</h2>
                  <span className="mini suave">{elegido.nombre}</span>
                </header>
                <div className="lista">
                  {vecinas.map((v) => (
                    <Link
                      key={v.inicio}
                      className="item pulsable"
                      href={`/admin/turnos?empleado=${elegido.id}&semana=${v.inicio}`}
                    >
                      <div className="crece">
                        <p style={{ fontWeight: v.inicio === semana ? 650 : 550 }}>
                          Semana {numeroSemanaISO(v.inicio)}
                          {v.inicio === semana && ' · la que estás viendo'}
                        </p>
                        <p className="mini suave">{rangoSemanaTxt(v.inicio)}</p>
                      </div>
                      {v.vacia ? (
                        <span className="pill">Sin planificar</span>
                      ) : (
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {formatMinutos(v.minutos)}
                          {v.libres > 0 && (
                            <span className="mini suave"> · {v.libres} libres</span>
                          )}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              <details className="tarjeta">
                <summary className="desplegable">
                  Patrón semanal (opcional) · {formatMinutos(minutosSemanaPatron)}
                </summary>
                <p className="pequeno suave" style={{ margin: '12px 0' }}>
                  Un horario fijo que se repite. Solo hace falta si alguien tiene siempre el mismo
                  horario: con el planificador de arriba y «copiar la semana anterior» normalmente
                  sobra. Contrato {elegido.horas_semana} h.
                </p>

                {plantillas.length === 0 ? (
                  <p className="vacio">Sin patrón definido</p>
                ) : (
                  <div className="lista">
                    {plantillas.map((p) => (
                      <div key={p.id} className="item">
                        <span style={{ minWidth: 84, fontWeight: 550 }}>
                          {DIAS_SEMANA[p.dia_semana]}
                        </span>
                        <span className="crece mono pequeno">
                          {p.hora_inicio.slice(0, 5)}–{p.hora_fin.slice(0, 5)}
                          {p.pausa_min > 0 && ` · ${p.pausa_min} min pausa`}
                        </span>
                        <span className="pill mono">{formatMinutos(minutosTurno(p))}</span>
                        <Formulario
                          accion={borrarPlantilla}
                          boton="Quitar"
                          botonClase="btn mini peligro"
                          confirmar="¿Quitar este tramo del patrón?"
                        >
                          <input type="hidden" name="id" value={p.id} />
                        </Formulario>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rejilla dos" style={{ marginTop: 16 }}>
                  <div>
                    <p className="mini suave" style={{ marginBottom: 8 }}>
                      Añadir un tramo. Para un día partido, añádelo dos veces con horas distintas.
                    </p>
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
                          <input id="hf" name="hora_fin" type="time" required defaultValue="14:00" />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="pausa">Pausa (minutos)</label>
                        <input id="pausa" name="pausa_min" type="number" min={0} max={480} defaultValue={0} />
                      </div>
                    </Formulario>
                  </div>

                  <div>
                    <p className="mini suave" style={{ marginBottom: 8 }}>
                      Volcar el patrón a un rango de fechas. No toca los días que ya tengan algo
                      planificado.
                    </p>
                    <Formulario accion={generarTurnos} boton="Volcar el patrón">
                      <input type="hidden" name="empleado_id" value={elegido.id} />
                      <div className="campos dos">
                        <div>
                          <label htmlFor="g-desde">Desde</label>
                          <input id="g-desde" name="desde" type="date" required defaultValue={semana} />
                        </div>
                        <div>
                          <label htmlFor="g-hasta">Hasta</label>
                          <input
                            id="g-hasta"
                            name="hasta"
                            type="date"
                            required
                            defaultValue={finSemana(sumarDias(semana, 21))}
                          />
                        </div>
                      </div>
                    </Formulario>
                  </div>
                </div>
              </details>

              <Link className="btn" href={`/admin/informes?empleado=${elegido.id}`}>
                Ver informe de {elegido.nombre.split(' ')[0]}
              </Link>
            </>
          )}
        </>
      )}
    </main>
  )
}
