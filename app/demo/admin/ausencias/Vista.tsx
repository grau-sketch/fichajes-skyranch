'use client'

import { useState } from 'react'
import { useDemo } from '@/components/DemoProvider'
import ListaAusencias from '@/components/ListaAusencias'
import PedirAusencia from '@/components/PedirAusencia'
import { resumenVacaciones } from '@/lib/ausencias'
import { DIAS_VACACIONES_MINIMO, type TipoAusencia } from '@/lib/constants'
import { HOY } from '@/lib/demo'
import { decidirAusenciaDemo, solicitarAusenciaDemo } from '@/lib/demoEstado'

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const anio = Number(HOY.slice(0, 4))
  const equipo = estado.perfiles.filter((p) => p.id !== estado.admin && p.activo)
  const [elegidoId, setElegidoId] = useState(equipo[0]?.id ?? '')
  const elegido = equipo.find((p) => p.id === elegidoId) ?? equipo[0]

  const nombrePor = Object.fromEntries(estado.perfiles.map((p) => [p.id, p.nombre]))
  const pendientes = estado.ausencias.filter((a) => a.estado === 'pendiente')

  const decidir = {
    decidir: (form: FormData) =>
      aplicar((e) =>
        decidirAusenciaDemo(
          e,
          String(form.get('id')),
          String(form.get('estado')) as 'aprobada' | 'rechazada' | 'cancelada',
          String(form.get('nota') ?? ''),
          e.admin,
        ),
      ),
  }

  return (
    <>

      <main className="pagina">
        <div className="tarjeta">
          <header>
            <h2>Pendientes de decidir</h2>
            {pendientes.length > 0 && <span className="pill aviso">{pendientes.length}</span>}
          </header>
          {pendientes.length === 0 ? (
            <p className="vacio">No hay solicitudes esperando</p>
          ) : (
            <ListaAusencias
              ausencias={pendientes}
              nombrePor={nombrePor}
              puedeDecidir
              demo={decidir}
            />
          )}
        </div>

        <div className="tarjeta">
          <header>
            <h2>Vacaciones del equipo</h2>
            <span className="mini suave">días naturales</span>
          </header>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="num">Del año</th>
                  <th className="num">Disfrutados</th>
                  <th className="num">Por aprobar</th>
                  <th className="num">Restantes</th>
                </tr>
              </thead>
              <tbody>
                {equipo.map((p) => {
                  const v = resumenVacaciones(
                    estado.ausencias.filter((a) => a.empleado_id === p.id),
                    p.dias_vacaciones,
                    anio,
                  )
                  return (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td className="num mono">{v.total}</td>
                      <td className="num mono">{v.usados}</td>
                      <td className="num mono">{v.pendientes}</td>
                      <td className="num mono">
                        <strong>{v.restantes}</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mini suave" style={{ marginTop: 12 }}>
            El mínimo legal son {DIAS_VACACIONES_MINIMO} días naturales al año.
          </p>
        </div>

        {elegido && (
          <div className="tarjeta">
            <header>
              <h2>Registrar una ausencia</h2>
            </header>
            <p className="pequeno suave" style={{ marginBottom: 14 }}>
              Lo que registres aquí entra ya aprobado y descuenta horas del objetivo del periodo.
              Las faltas no justificadas también se anotan aquí.
            </p>
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="empleado">Persona</label>
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
            <PedirAusencia
              empleadoId={elegido.id}
              comoGestor
              demo={(form) =>
                aplicar((e) =>
                  solicitarAusenciaDemo(e, {
                    empleado_id: elegido.id,
                    tipo: String(form.get('tipo')) as TipoAusencia,
                    desde: String(form.get('desde')),
                    hasta: String(form.get('hasta')),
                    motivo: String(form.get('motivo') ?? ''),
                    justificante: String(form.get('justificante') ?? '') || null,
                    comoGestor: true,
                  }),
                )
              }
            />
          </div>
        )}

        <div className="tarjeta">
          <header>
            <h2>Historial del año</h2>
            <span className="mini suave">{estado.ausencias.length}</span>
          </header>
          <ListaAusencias
            ausencias={estado.ausencias}
            nombrePor={nombrePor}
            puedeDecidir
            demo={decidir}
          />
        </div>
      </main>
    </>
  )
}
