'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useDemo } from '@/components/DemoProvider'
import Formulario from '@/components/Formulario'
import PlanificadorSemana from '@/components/PlanificadorSemana'
import { DIAS_SEMANA, TZ } from '@/lib/constants'
import {
  borrarPlantillaDemo,
  copiarSemanaDemo,
  generarTurnosDemo,
  guardarPlantillaDemo,
  guardarSemanaDemo,
} from '@/lib/demoEstado'
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

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const hoy = hoyLocal(TZ)
  const equipo = estado.perfiles.filter((p) => p.id !== estado.admin && p.activo)
  const [elegidoId, setElegidoId] = useState(equipo[0]?.id ?? '')
  const [semana, setSemana] = useState(() => inicioSemana(hoy))
  const elegido = equipo.find((p) => p.id === elegidoId) ?? equipo[0]

  if (!elegido) {
    return (
      <main className="pagina">
        <p className="vacio">No hay empleados</p>
      </main>
    )
  }

  const finDeSemana = sumarDias(semana, 6)
  const deLaSemana = estado.turnos.filter(
    (t) => t.empleado_id === elegido.id && t.fecha >= semana && t.fecha <= finDeSemana,
  )
  const ausencias = estado.ausencias.filter(
    (a) => a.empleado_id === elegido.id && a.estado === 'aprobada',
  )

  const plantillas = estado.plantillas
    .filter((p) => p.empleado_id === elegido.id)
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
  const minutosPatron = plantillas
    .filter((p) => p.activo)
    .reduce((s, p) => s + minutosTurno(p), 0)

  const vecinas = [-7, 0, 7, 14].map((salto) => {
    const inicio = sumarDias(semana, salto)
    const fin = sumarDias(inicio, 6)
    const suyos = estado.turnos.filter(
      (t) => t.empleado_id === elegido.id && t.fecha >= inicio && t.fecha <= fin,
    )
    return {
      inicio,
      minutos: suyos.reduce((s, t) => s + minutosTurno(t), 0),
      libres: suyos.filter((t) => t.estado === 'libre').length,
      vacia: suyos.length === 0,
    }
  })

  // En la demo la navegación entre semanas es estado local: no hay URL que
  // recargar, así que se intercepta el clic de los enlaces del planificador.
  const irA = (destino: string) => setSemana(inicioSemana(destino))

  return (
    <main className="pagina" onClickCapture={(ev) => {
      const enlace = (ev.target as HTMLElement).closest('a[href*="semana="]')
      if (!enlace) return
      ev.preventDefault()
      const s = new URL((enlace as HTMLAnchorElement).href, window.location.origin).searchParams.get('semana')
      if (s) irA(s)
    }}>
      <div className="fila" style={{ gap: 8, flexWrap: 'wrap' }}>
        {equipo.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`btn${p.id === elegido.id ? ' primario' : ''}`}
            onClick={() => setElegidoId(p.id)}
          >
            {p.nombre.split(' ')[0]}
          </button>
        ))}
      </div>

      <PlanificadorSemana
        key={`${elegido.id}-${semana}`}
        empleado={elegido}
        semana={semana}
        turnos={deLaSemana}
        ausencias={ausencias}
        hoy={hoy}
        base="/demo"
        demo={{
          guardarSemana: (form) =>
            aplicar((e) =>
              guardarSemanaDemo(e, {
                empleado_id: elegido.id,
                desde: String(form.get('desde') ?? semana),
                dias: Array.from({ length: 7 }, (_, i) => ({
                  modo: String(form.get(`d${i}`) ?? 'nada') as 'trabaja' | 'libre' | 'nada',
                  tramos: [1, 2].map((n) => ({
                    inicio: String(form.get(`d${i}_${n}i`) ?? '').slice(0, 5),
                    fin: String(form.get(`d${i}_${n}f`) ?? '').slice(0, 5),
                    pausa: Number(form.get(`d${i}_${n}p`) ?? 0),
                  })),
                })),
              }),
            ),
          copiarSemana: (form) =>
            aplicar((e) =>
              copiarSemanaDemo(
                e,
                elegido.id,
                String(form.get('origen') ?? ''),
                String(form.get('destino') ?? ''),
              ),
            ),
        }}
      />

      <div className="tarjeta">
        <header>
          <h2>De un vistazo</h2>
          <span className="mini suave">{elegido.nombre}</span>
        </header>
        <div className="lista">
          {vecinas.map((v) => (
            <button
              key={v.inicio}
              type="button"
              className="item pulsable"
              style={{ width: '100%', textAlign: 'left', background: 'none', border: 0 }}
              onClick={() => irA(v.inicio)}
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
                  {v.libres > 0 && <span className="mini suave"> · {v.libres} libres</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <details className="tarjeta">
        <summary className="desplegable">
          Patrón semanal (opcional) · {formatMinutos(minutosPatron)}
        </summary>
        <p className="pequeno suave" style={{ margin: '12px 0' }}>
          Un horario fijo que se repite. Con el planificador de arriba y «copiar la semana
          anterior» normalmente sobra. Contrato {elegido.horas_semana} h.
        </p>

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
                  confirmar="¿Quitar este tramo del patrón?"
                  demo={() => aplicar((e) => borrarPlantillaDemo(e, p.id))}
                />
              </div>
            ))}
          </div>
        )}

        <div className="rejilla dos" style={{ marginTop: 16 }}>
          <div>
            <p className="mini suave" style={{ marginBottom: 8 }}>
              Añadir un tramo. Para un día partido, añádelo dos veces con horas distintas.
            </p>
            <Formulario
              boton="Añadir al patrón"
              limpiarAlEnviar
              demo={(form) =>
                aplicar((e) =>
                  guardarPlantillaDemo(e, {
                    empleado_id: elegido.id,
                    dia_semana: Number(form.get('dia_semana') ?? 1),
                    hora_inicio: String(form.get('hora_inicio') ?? ''),
                    hora_fin: String(form.get('hora_fin') ?? ''),
                    pausa_min: Number(form.get('pausa_min') ?? 0),
                  }),
                )
              }
            >
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
              Volcar el patrón a un rango. No toca los días que ya tengan algo planificado.
            </p>
            <Formulario
              boton="Volcar el patrón"
              demo={(form) =>
                aplicar((e) =>
                  generarTurnosDemo(
                    e,
                    elegido.id,
                    String(form.get('desde') ?? ''),
                    String(form.get('hasta') ?? ''),
                  ),
                )
              }
            >
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

      <Link className="btn" href={`/demo/admin/informes?empleado=${elegido.id}`}>
        Ver informe de {elegido.nombre.split(' ')[0]}
      </Link>
    </main>
  )
}
