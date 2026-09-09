'use client'

import Link from 'next/link'
import { useState } from 'react'
import BloqueInforme, { type BloqueDatos } from '@/components/BloqueInforme'
import { useDemo } from '@/components/DemoProvider'
import Formulario from '@/components/Formulario'
import { ETIQUETA_TIPO, TIPOS_FICHAJE, TZ, type TipoFichaje } from '@/lib/constants'
import { HOY } from '@/lib/demo'
import { anularDemo, corregirDemo, fichajeManualDemo } from '@/lib/demoEstado'
import { fechaLocal, finMes, formatHoras, inicioMes } from '@/lib/fechas'
import { agruparJornadas, minutosTurno, turnosSinFichar } from '@/lib/jornada'

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const [filtro, setFiltro] = useState({
    desde: inicioMes(HOY),
    hasta: finMes(HOY),
    empleado: 'todos',
  })
  const [aplicado, setAplicado] = useState(filtro)

  const { desde, hasta, empleado } = aplicado
  const nombrePor = Object.fromEntries(estado.perfiles.map((p) => [p.id, p.nombre]))
  const equipo = estado.perfiles.filter((p) => p.id !== estado.admin)

  const bloques: BloqueDatos[] = equipo
    .filter((p) => empleado === 'todos' || p.id === empleado)
    .map((p) => {
      const suyos = estado.fichajes.filter((f) => f.empleado_id === p.id)
      const jornadas = agruparJornadas(suyos, new Date(), TZ)
        .filter((j) => j.fecha >= desde && j.fecha <= hasta)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
      const susTurnos = estado.turnos.filter(
        (t) =>
          t.empleado_id === p.id &&
          t.fecha >= desde &&
          t.fecha <= hasta &&
          t.estado !== 'cancelado',
      )
      const enRango = suyos.filter((f) => {
        const dia = fechaLocal(f.ts, TZ)
        return dia >= desde && dia <= hasta
      })

      return {
        perfil: p,
        jornadas,
        fichajes: enRango,
        sinFichar: turnosSinFichar(susTurnos, jornadas, new Date(), TZ),
        corregidos: enRango.filter((f) => f.origen === 'manual' || f.anulado_en !== null).length,
        trabajado: jornadas.reduce((s, j) => s + j.minutos_trabajados, 0),
        planificado: susTurnos.reduce((s, t) => s + minutosTurno(t), 0),
        aRevisar: jornadas.filter((j) => j.anomalias.length > 0).length,
      }
    })

  const totalTrabajado = bloques.reduce((s, b) => s + b.trabajado, 0)
  const totalPlanificado = bloques.reduce((s, b) => s + b.planificado, 0)

  const acciones = {
    corregir: (form: FormData) =>
      aplicar((e) =>
        corregirDemo(
          e,
          String(form.get('id')),
          new Date(`${form.get('fecha')}T${form.get('hora')}:00`).toISOString(),
          String(form.get('tipo')) as TipoFichaje,
          String(form.get('motivo') ?? ''),
          e.admin,
        ),
      ),
    anular: (form: FormData) =>
      aplicar((e) =>
        anularDemo(e, String(form.get('id')), String(form.get('motivo') ?? ''), e.admin),
      ),
  }

  return (
    <>
      <header className="cabecera">
        <div className="cabecera-inner">
          <div className="crece">
            <Link href="/demo/admin" className="mini suave">
              ← Volver
            </Link>
            <h1>Informes</h1>
            <p className="quien">Registro de jornada</p>
          </div>
        </div>
      </header>

      <main className="pagina">
        <div className="tarjeta columna">
          <div className="campos dos">
            <div>
              <label htmlFor="d">Desde</label>
              <input
                id="d"
                type="date"
                value={filtro.desde}
                onChange={(ev) => setFiltro({ ...filtro, desde: ev.target.value })}
              />
            </div>
            <div>
              <label htmlFor="h">Hasta</label>
              <input
                id="h"
                type="date"
                value={filtro.hasta}
                onChange={(ev) => setFiltro({ ...filtro, hasta: ev.target.value })}
              />
            </div>
          </div>
          <div>
            <label htmlFor="e">Empleado</label>
            <select
              id="e"
              value={filtro.empleado}
              onChange={(ev) => setFiltro({ ...filtro, empleado: ev.target.value })}
            >
              <option value="todos">Todo el equipo</option>
              {equipo.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn primario" onClick={() => setAplicado(filtro)}>
            Ver informe
          </button>
        </div>

        <p className="nota info">
          En la app real estos dos botones descargan los CSV. Aquí no hay servidor, así que se
          quedan como muestra; lo que sí funciona es corregir y anular fichajes.
        </p>
        <div className="fila" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="btn crece" aria-disabled>
            CSV de jornadas
          </span>
          <span className="btn crece" aria-disabled>
            CSV con historial
          </span>
        </div>

        <div className="metricas">
          <div>
            <p className="v mono">{formatHoras(totalTrabajado)}</p>
            <p className="k">Trabajado</p>
          </div>
          <div>
            <p className="v mono">{formatHoras(totalPlanificado)}</p>
            <p className="k">Planificado</p>
          </div>
          <div>
            <p className="v mono">{bloques.length}</p>
            <p className="k">Personas</p>
          </div>
        </div>

        <p className="mini suave">
          Periodo {desde} a {hasta}. Horas en formato h:mm.
        </p>

        {bloques.length === 0 && <p className="vacio">Sin datos en este periodo</p>}

        {bloques.map((b) => (
          <BloqueInforme
            key={b.perfil.id}
            b={b}
            nombrePor={nombrePor}
            tz={TZ}
            demo={acciones}
          />
        ))}

        <details className="tarjeta">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Añadir un fichaje que falta</summary>
          <p className="pequeno suave" style={{ margin: '10px 0' }}>
            No borra nada: añade un fichaje marcado como manual, con tu nombre y el motivo, para que
            el registro siga siendo trazable.
          </p>
          <Formulario
            boton="Añadir fichaje"
            limpiarAlEnviar
            demo={(form) =>
              aplicar((e) =>
                fichajeManualDemo(
                  e,
                  String(form.get('empleado_id')),
                  String(form.get('tipo')) as TipoFichaje,
                  new Date(`${form.get('fecha')}T${form.get('hora')}:00`).toISOString(),
                  String(form.get('nota') ?? ''),
                  e.admin,
                ),
              )
            }
          >
            <div>
              <label htmlFor="c-empleado">Empleado</label>
              <select id="c-empleado" name="empleado_id" required defaultValue={equipo[0]?.id}>
                {equipo.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="c-tipo">Tipo</label>
              <select id="c-tipo" name="tipo" required defaultValue="entrada">
                {TIPOS_FICHAJE.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="campos dos">
              <div>
                <label htmlFor="c-fecha">Fecha</label>
                <input id="c-fecha" name="fecha" type="date" required defaultValue={HOY} />
              </div>
              <div>
                <label htmlFor="c-hora">Hora</label>
                <input id="c-hora" name="hora" type="time" required defaultValue="09:00" />
              </div>
            </div>
            <div>
              <label htmlFor="c-nota">Motivo</label>
              <input
                id="c-nota"
                name="nota"
                required
                minLength={3}
                placeholder="Se quedó sin batería al salir"
              />
            </div>
          </Formulario>
        </details>
      </main>
    </>
  )
}
