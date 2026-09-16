import Formulario from '@/components/Formulario'
import { decidirAusencia, editarAusencia } from '@/app/actions'
import { ETIQUETA_AUSENCIA, TIPOS_AUSENCIA, ETIQUETA_ESTADO_AUSENCIA } from '@/lib/constants'
import { diasEntre, formatFechaCorta } from '@/lib/fechas'
import type { Ausencia } from '@/lib/types'
import VerJustificante from '@/components/VerJustificante'

const TONO = {
  pendiente: 'aviso',
  aprobada: 'ok',
  rechazada: 'error',
  cancelada: '',
} as const

type Manejadores = {
  decidir: (form: FormData) => { ok?: string; error?: string }
  editar?: (form: FormData) => { ok?: string; error?: string }
}

/**
 * Ausencias de una o varias personas. `puedeDecidir` la usa el responsable
 * (admin o encargado) para aprobar o rechazar; el trabajador solo puede
 * cancelar lo pendiente. `puedeEditar` es más estrecho: corregir una ausencia
 * ya decidida es cosa solo del administrador.
 */
export default function ListaAusencias({
  ausencias,
  nombrePor,
  puedeDecidir = false,
  puedeEditar = false,
  yo,
  demo,
}: {
  ausencias: Ausencia[]
  nombrePor?: Record<string, string>
  puedeDecidir?: boolean
  puedeEditar?: boolean
  /** Id de quien mira, para permitirle cancelar sus solicitudes. */
  yo?: string
  demo?: Manejadores
}) {
  if (ausencias.length === 0) {
    return <p className="vacio">Sin ausencias registradas</p>
  }

  const orden = [...ausencias].sort((a, b) => b.desde.localeCompare(a.desde))

  return (
    <div className="lista">
      {orden.map((a) => {
        const dias = diasEntre(a.desde, a.hasta)
        const suya = yo !== undefined && a.empleado_id === yo
        return (
          <div key={a.id} className="columna" style={{ gap: 6, padding: '12px 0' }}>
            <div className="fila entre" style={{ gap: 8 }}>
              <div className="crece">
                <p style={{ fontWeight: 550 }}>
                  {ETIQUETA_AUSENCIA[a.tipo]}
                  {nombrePor && ` · ${nombrePor[a.empleado_id] ?? 'alguien'}`}
                </p>
                <p className="mini suave mono">
                  {formatFechaCorta(a.desde)}
                  {a.hasta !== a.desde && ` → ${formatFechaCorta(a.hasta)}`}
                  {` · ${dias} ${dias === 1 ? 'día' : 'días'}`}
                </p>
              </div>
              <span className={`pill ${TONO[a.estado]}`}>{ETIQUETA_ESTADO_AUSENCIA[a.estado]}</span>
            </div>

            {a.motivo && <p className="mini suave">«{a.motivo}»</p>}
            {a.nota_decision && (
              <p className="mini" style={{ color: 'var(--texto-2)' }}>
                Respuesta: {a.nota_decision}
              </p>
            )}
            {a.nota_edicion && (
              <p className="mini" style={{ color: 'var(--texto-2)' }}>
                Corregido: {a.nota_edicion}
              </p>
            )}
            {a.justificante && <VerJustificante ruta={a.justificante} />}

            {a.estado === 'pendiente' && puedeDecidir && (
              <div className="fila no-imprimir" style={{ gap: 10, flexWrap: 'wrap' }}>
                <Formulario
                  accion={decidirAusencia}
                  boton="Aprobar"
                  botonClase="btn primario mini"
                  demo={demo?.decidir}
                >
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="estado" value="aprobada" />
                </Formulario>

                <details style={{ flex: '1 1 auto' }}>
                  <summary className="mini" style={{ cursor: 'pointer', color: 'var(--error)' }}>
                    Rechazar
                  </summary>
                  <div style={{ marginTop: 10 }}>
                    <Formulario
                      accion={decidirAusencia}
                      boton="Rechazar solicitud"
                      botonClase="btn peligro"
                      demo={demo?.decidir}
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="estado" value="rechazada" />
                      <div>
                        <label htmlFor={`nota-${a.id}`}>Motivo</label>
                        <input
                          id={`nota-${a.id}`}
                          name="nota"
                          required
                          minLength={3}
                          placeholder="Esa semana no hay quien cubra"
                        />
                      </div>
                    </Formulario>
                  </div>
                </details>
              </div>
            )}

            {a.estado === 'pendiente' && suya && !puedeDecidir && (
              <Formulario
                accion={decidirAusencia}
                boton="Cancelar solicitud"
                botonClase="btn mini"
                confirmar="¿Retirar la solicitud?"
                demo={demo?.decidir}
              >
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="estado" value="cancelada" />
              </Formulario>
            )}

            {puedeEditar && a.estado !== 'cancelada' && (
              <details className="no-imprimir">
                <summary className="mini" style={{ cursor: 'pointer' }}>
                  Editar
                </summary>
                <div style={{ marginTop: 10 }}>
                  <Formulario
                    accion={editarAusencia}
                    boton="Guardar corrección"
                    botonClase="btn mini"
                    demo={demo?.editar}
                  >
                    <input type="hidden" name="id" value={a.id} />
                    <div>
                      <label htmlFor={`tipo-${a.id}`}>Tipo</label>
                      <select id={`tipo-${a.id}`} name="tipo" defaultValue={a.tipo}>
                        {TIPOS_AUSENCIA.map((t) => (
                          <option key={t} value={t}>
                            {ETIQUETA_AUSENCIA[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="campos dos">
                      <div>
                        <label htmlFor={`desde-${a.id}`}>Desde</label>
                        <input
                          id={`desde-${a.id}`}
                          name="desde"
                          type="date"
                          defaultValue={a.desde}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor={`hasta-${a.id}`}>Hasta</label>
                        <input
                          id={`hasta-${a.id}`}
                          name="hasta"
                          type="date"
                          defaultValue={a.hasta}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`motivo-${a.id}`}>Motivo (opcional)</label>
                      <input id={`motivo-${a.id}`} name="motivo" defaultValue={a.motivo ?? ''} />
                    </div>
                    <div>
                      <label htmlFor={`nota-edicion-${a.id}`}>Por qué se corrige</label>
                      <input
                        id={`nota-edicion-${a.id}`}
                        name="nota"
                        required
                        minLength={3}
                        placeholder="Se registró un día de más por error"
                      />
                    </div>
                  </Formulario>
                </div>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}
