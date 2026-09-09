'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useDemo } from '@/components/DemoProvider'
import Formulario from '@/components/Formulario'
import { DIAS_SEMANA, TZ } from '@/lib/constants'
import { HOY } from '@/lib/demo'
import {
  borrarPlantillaDemo,
  cancelarTurnoDemo,
  generarTurnosDemo,
  guardarPlantillaDemo,
  guardarTurnoDemo,
} from '@/lib/demoEstado'
import { finSemana, formatFechaLarga, formatMinutos, inicioSemana, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const equipo = estado.perfiles.filter((p) => p.id !== estado.admin && p.activo)
  const [elegidoId, setElegidoId] = useState(equipo[0]?.id ?? '')
  const elegido = equipo.find((p) => p.id === elegidoId) ?? equipo[0]

  if (!elegido) return <main className="pagina"><p className="vacio">No hay empleados</p></main>

  const plantillas = estado.plantillas
    .filter((p) => p.empleado_id === elegido.id)
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
  const turnos = estado.turnos
    .filter((t) => t.empleado_id === elegido.id && t.fecha >= HOY)
    .sort((a, b) => `${a.fecha}${a.hora_inicio}`.localeCompare(`${b.fecha}${b.hora_inicio}`))
  const minutosPatron = plantillas
    .filter((p) => p.activo)
    .reduce((s, p) => s + minutosTurno(p), 0)
  const descuadre = Math.abs(minutosPatron - elegido.horas_semana * 60) > 30

  return (
    <>

      <main className="pagina">
        <div className="tarjeta columna">
          <div>
            <label htmlFor="empleado">Empleado</label>
            <select
              id="empleado"
              value={elegido.id}
              onChange={(ev) => setElegidoId(ev.target.value)}
            >
              {equipo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tarjeta">
          <header>
            <div>
              <h2>Patrón semanal</h2>
              <p className="mini suave">
                Contrato {elegido.horas_semana} h · patrón {formatMinutos(minutosPatron)}
                {minutosPatron > 0 && descuadre && ' ⚠ no cuadra con el contrato'}
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
                    boton="Quitar"
                    botonClase="btn mini peligro"
                    confirmar="¿Quitar este día del patrón?"
                    demo={(form) => aplicar((e) => borrarPlantillaDemo(e, String(form.get('id'))))}
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
              <Formulario
                boton="Añadir al patrón"
                limpiarAlEnviar
                demo={(form) =>
                  aplicar((e) =>
                    guardarPlantillaDemo(e, {
                      empleado_id: elegido.id,
                      dia_semana: Number(form.get('dia_semana')),
                      hora_inicio: String(form.get('hora_inicio')),
                      hora_fin: String(form.get('hora_fin')),
                      pausa_min: Number(form.get('pausa_min') ?? 0),
                    }),
                  )
                }
              >
                <div>
                  <label htmlFor="dia">Día</label>
                  <select id="dia" name="dia_semana" defaultValue="6">
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
                    <input id="hi" name="hora_inicio" type="time" required defaultValue="10:00" />
                  </div>
                  <div>
                    <label htmlFor="hf">Salida</label>
                    <input id="hf" name="hora_fin" type="time" required defaultValue="15:00" />
                  </div>
                </div>
                <div>
                  <label htmlFor="pausa">Pausa (minutos)</label>
                  <input id="pausa" name="pausa_min" type="number" min={0} max={480} defaultValue={0} />
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
          <Formulario
            boton="Generar turnos"
            demo={(form) =>
              aplicar((e) =>
                generarTurnosDemo(
                  e,
                  elegido.id,
                  String(form.get('desde')),
                  String(form.get('hasta')),
                ),
              )
            }
          >
            <div className="campos dos">
              <div>
                <label htmlFor="g-desde">Desde</label>
                <input
                  id="g-desde"
                  name="desde"
                  type="date"
                  required
                  defaultValue={inicioSemana(HOY)}
                />
              </div>
              <div>
                <label htmlFor="g-hasta">Hasta</label>
                <input
                  id="g-hasta"
                  name="hasta"
                  type="date"
                  required
                  defaultValue={finSemana(sumarDias(HOY, 28))}
                />
              </div>
            </div>
          </Formulario>
        </div>

        <div className="tarjeta">
          <header>
            <h2>Turnos planificados</h2>
            <span className="mini suave mono">
              {formatMinutos(
                turnos.filter((t) => t.estado !== 'cancelado').reduce((s, t) => s + minutosTurno(t), 0),
              )}
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
                      boton="Cancelar"
                      botonClase="btn mini peligro"
                      confirmar="¿Cancelar este turno?"
                      demo={(form) => aplicar((e) => cancelarTurnoDemo(e, String(form.get('id'))))}
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
              <Formulario
                boton="Guardar turno"
                limpiarAlEnviar
                demo={(form) =>
                  aplicar((e) =>
                    guardarTurnoDemo(e, {
                      empleado_id: elegido.id,
                      fecha: String(form.get('fecha')),
                      hora_inicio: String(form.get('hora_inicio')),
                      hora_fin: String(form.get('hora_fin')),
                      pausa_min: Number(form.get('pausa_min') ?? 0),
                    }),
                  )
                }
              >
                <div>
                  <label htmlFor="t-fecha">Fecha</label>
                  <input id="t-fecha" name="fecha" type="date" required defaultValue={HOY} />
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

        <Link className="btn" href="/demo/admin/informes">
          Ver informe de {elegido.nombre.split(' ')[0]}
        </Link>
      </main>
    </>
  )
}
