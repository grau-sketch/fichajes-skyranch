import { anularFichaje, corregirHora } from '@/app/actions'
import Formulario from '@/components/Formulario'
import { ETIQUETA_ORIGEN, ETIQUETA_TIPO, TIPOS_FICHAJE } from '@/lib/constants'
import { fechaLocal, formatFechaCorta, formatFechaLarga, horaLocal } from '@/lib/fechas'
import { formatearDistancia } from '@/lib/geo'
import type { Fichaje } from '@/lib/types'

/**
 * Historial completo de movimientos de una persona, incluidos los anulados y
 * las correcciones. Es la trazabilidad que hay que poder mostrar: qué fichó,
 * qué no fichó, y qué tocó el responsable, cuándo y por qué.
 */
export default function HistorialFichajes({
  fichajes,
  nombrePor,
  tz,
  editable = true,
  demo,
}: {
  fichajes: Fichaje[]
  nombrePor: Record<string, string>
  tz: string
  editable?: boolean
  /** Manejadores locales de la demo. El FormData lleva ya el id del fichaje. */
  demo?: {
    corregir: (form: FormData) => { ok?: string; error?: string }
    anular: (form: FormData) => { ok?: string; error?: string }
  }
}) {
  if (fichajes.length === 0) {
    return <p className="vacio">Sin movimientos en este periodo</p>
  }

  const orden = [...fichajes].sort((a, b) => b.ts.localeCompare(a.ts))
  const porFecha = new Map<string, Fichaje[]>()
  for (const f of orden) {
    const dia = fechaLocal(f.ts, tz)
    porFecha.set(dia, [...(porFecha.get(dia) ?? []), f])
  }
  const indice = new Map(fichajes.map((f) => [f.id, f]))

  return (
    <div className="columna" style={{ gap: 18 }}>
      {[...porFecha.entries()].map(([dia, delDia]) => (
        <div key={dia} className="columna" style={{ gap: 8 }}>
          <p className="mini suave" style={{ textTransform: 'capitalize', fontWeight: 600 }}>
            {formatFechaLarga(dia, tz)}
          </p>
          <div className="lista">
            {delDia.map((f) => {
              const anulado = f.anulado_en !== null
              const original = f.corrige_a ? indice.get(f.corrige_a) : undefined
              return (
                <div key={f.id} className="columna" style={{ gap: 6, padding: '10px 0' }}>
                  <div className="fila" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <span
                      className="mono"
                      style={{
                        fontWeight: 650,
                        minWidth: 48,
                        textDecoration: anulado ? 'line-through' : undefined,
                        opacity: anulado ? 0.55 : 1,
                      }}
                    >
                      {horaLocal(f.ts, tz)}
                    </span>
                    <span
                      className="crece"
                      style={{
                        textDecoration: anulado ? 'line-through' : undefined,
                        opacity: anulado ? 0.55 : 1,
                      }}
                    >
                      {ETIQUETA_TIPO[f.tipo]}
                    </span>

                    {anulado && <span className="pill error">Anulado</span>}
                    {f.origen !== 'app' && <span className="pill">{ETIQUETA_ORIGEN[f.origen]}</span>}
                    {f.dentro_radio === true && <span className="pill ok">En el centro</span>}
                    {f.dentro_radio === false && (
                      <span className="pill error">
                        {formatearDistancia(Number(f.distancia_m))} del centro
                      </span>
                    )}
                    {f.dentro_radio === null && !anulado && f.origen === 'app' && (
                      <span className="pill aviso">Sin ubicación</span>
                    )}
                  </div>

                  {original && (
                    <p className="mini suave">
                      Corrige el fichaje de las {horaLocal(original.ts, tz)} (
                      {ETIQUETA_TIPO[original.tipo]})
                      {f.editado_por && ` · ${nombrePor[f.editado_por] ?? 'un responsable'}`}
                      {f.nota && ` · «${f.nota}»`}
                    </p>
                  )}

                  {!original && f.origen === 'manual' && (
                    <p className="mini suave">
                      Añadido a mano
                      {f.editado_por && ` por ${nombrePor[f.editado_por] ?? 'un responsable'}`}
                      {f.nota && ` · «${f.nota}»`}
                    </p>
                  )}

                  {anulado && (
                    <p className="mini" style={{ color: 'var(--error)' }}>
                      Anulado
                      {f.anulado_por && ` por ${nombrePor[f.anulado_por] ?? 'un responsable'}`}
                      {` el ${formatFechaCorta(f.anulado_en!, tz)} a las ${horaLocal(f.anulado_en, tz)}`}
                      {f.motivo_anulacion && ` · «${f.motivo_anulacion}»`}
                    </p>
                  )}

                  {editable && !anulado && (
                    <div className="fila no-imprimir" style={{ gap: 10, flexWrap: 'wrap' }}>
                      <details style={{ flex: '1 1 auto' }}>
                        <summary className="mini" style={{ cursor: 'pointer', color: 'var(--marca)' }}>
                          Corregir
                        </summary>
                        <div style={{ marginTop: 10 }}>
                          <Formulario
                            accion={corregirHora}
                            boton="Guardar corrección"
                            demo={demo?.corregir}
                          >
                            <input type="hidden" name="id" value={f.id} />
                            <div className="campos dos">
                              <div>
                                <label htmlFor={`cf-${f.id}`}>Fecha</label>
                                <input
                                  id={`cf-${f.id}`}
                                  name="fecha"
                                  type="date"
                                  required
                                  defaultValue={fechaLocal(f.ts, tz)}
                                />
                              </div>
                              <div>
                                <label htmlFor={`ch-${f.id}`}>Hora</label>
                                <input
                                  id={`ch-${f.id}`}
                                  name="hora"
                                  type="time"
                                  required
                                  defaultValue={horaLocal(f.ts, tz)}
                                />
                              </div>
                            </div>
                            <div>
                              <label htmlFor={`ct-${f.id}`}>Tipo</label>
                              <select id={`ct-${f.id}`} name="tipo" defaultValue={f.tipo}>
                                {TIPOS_FICHAJE.map((t) => (
                                  <option key={t} value={t}>
                                    {ETIQUETA_TIPO[t]}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor={`cm-${f.id}`}>Motivo</label>
                              <input
                                id={`cm-${f.id}`}
                                name="motivo"
                                required
                                minLength={3}
                                placeholder="Fichó tarde por avería del móvil"
                              />
                            </div>
                          </Formulario>
                        </div>
                      </details>

                      <details style={{ flex: '1 1 auto' }}>
                        <summary className="mini" style={{ cursor: 'pointer', color: 'var(--error)' }}>
                          Anular
                        </summary>
                        <div style={{ marginTop: 10 }}>
                          <Formulario
                            accion={anularFichaje}
                            boton="Anular fichaje"
                            botonClase="btn peligro"
                            confirmar="El fichaje dejará de contar, pero seguirá en el historial. ¿Anularlo?"
                            demo={demo?.anular}
                          >
                            <input type="hidden" name="id" value={f.id} />
                            <div>
                              <label htmlFor={`am-${f.id}`}>Motivo</label>
                              <input
                                id={`am-${f.id}`}
                                name="motivo"
                                required
                                minLength={3}
                                placeholder="Fichaje duplicado"
                              />
                            </div>
                          </Formulario>
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
