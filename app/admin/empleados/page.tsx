import { redirect } from 'next/navigation'
import Cabecera from '@/components/Cabecera'
import BuscadorDireccion from '@/components/BuscadorDireccion'
import CampoPassword from '@/components/CampoPassword'
import Formulario from '@/components/Formulario'
import {
  crearEmpleado,
  guardarCentro,
  guardarEmpleado,
  restablecerPassword,
} from '@/app/actions'
import { ROLES } from '@/lib/constants'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Centro, Perfil } from '@/lib/types'

export const metadata = { title: 'Personal y centros' }
export const dynamic = 'force-dynamic'

const ETIQUETA_ROL = {
  admin: 'Administrador',
  encargado: 'Encargado',
  empleado: 'Trabajador',
} as const

export default async function Empleados() {
  const gestor = await requerirGestor()
  if (gestor.rol !== 'admin') redirect('/admin')

  const supabase = createClient()
  const [resPerfiles, resCentros] = await Promise.all([
    supabase.from('perfiles').select('*').order('nombre'),
    supabase.from('centros').select('*').order('nombre'),
  ])
  const perfiles = (resPerfiles.data ?? []) as Perfil[]
  const centros = (resCentros.data ?? []) as Centro[]
  const sinServiceRole = !process.env.SUPABASE_SERVICE_ROLE_KEY

  return (
    <>
      <Cabecera titulo="Personal y centros" volver="/admin" />
      <main className="pagina">
        {/* ------------------------------- Centros ------------------------------- */}
        <div className="tarjeta">
          <header>
            <h2>Centros de trabajo</h2>
            <span className="mini suave">{centros.length}</span>
          </header>

          {centros.length === 0 ? (
            <p className="vacio">Empieza creando el centro donde va a fichar la gente</p>
          ) : (
            <div className="lista">
              {centros.map((c) => (
                <details key={c.id} style={{ padding: '12px 0' }}>
                  <summary style={{ cursor: 'pointer' }}>
                    <strong>{c.nombre}</strong>{' '}
                    <span className="mini suave">
                      {c.lat !== null ? `radio ${c.radio_m} m` : 'sin coordenadas'}
                      {c.direccion && ` · ${c.direccion}`}
                    </span>
                  </summary>
                  <div style={{ marginTop: 12 }}>
                    <Formulario accion={guardarCentro} boton="Guardar centro">
                      <input type="hidden" name="id" value={c.id} />
                      <div>
                        <label htmlFor={`n-${c.id}`}>Nombre</label>
                        <input id={`n-${c.id}`} name="nombre" defaultValue={c.nombre} required />
                      </div>
                      <BuscadorDireccion
                        id={c.id}
                        direccion={c.direccion ?? ''}
                        lat={c.lat}
                        lon={c.lon}
                        radio={c.radio_m}
                      />
                    </Formulario>
                  </div>
                </details>
              ))}
            </div>
          )}

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Nuevo centro</summary>
            <div style={{ marginTop: 12 }}>
              <Formulario accion={guardarCentro} boton="Crear centro" limpiarAlEnviar>
                <div>
                  <label htmlFor="nc-nombre">Nombre</label>
                  <input id="nc-nombre" name="nombre" required placeholder="Local centro" />
                </div>
                <BuscadorDireccion id="nuevo" />
              </Formulario>
            </div>
          </details>
        </div>

        {/* ---------------------------- Nuevo trabajador ---------------------------- */}
        <div className="tarjeta">
          <header>
            <h2>Dar de alta a un trabajador</h2>
          </header>

          {sinServiceRole ? (
            <p className="nota aviso">
              Falta <code>SUPABASE_SERVICE_ROLE_KEY</code> en el servidor. Sin esa variable no se
              pueden crear cuentas desde aquí; habría que hacerlo desde el panel de Supabase.
            </p>
          ) : centros.length === 0 ? (
            <p className="nota aviso">Crea antes un centro para poder asignárselo.</p>
          ) : (
            <Formulario accion={crearEmpleado} boton="Crear cuenta" limpiarAlEnviar>
              <div>
                <label htmlFor="ne-nombre">Nombre y apellidos</label>
                <input id="ne-nombre" name="nombre" required minLength={2} placeholder="María López" />
              </div>
              <div>
                <label htmlFor="ne-email">Correo (con el que entrará)</label>
                <input
                  id="ne-email"
                  name="email"
                  type="email"
                  required
                  autoCapitalize="off"
                  placeholder="maria@empresa.com"
                />
              </div>
              <CampoPassword id="ne-password" />
              <div className="campos dos">
                <div>
                  <label htmlFor="ne-centro">Centro</label>
                  <select id="ne-centro" name="centro_id" defaultValue={centros[0]?.id ?? ''}>
                    {centros.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ne-horas">Horas/semana</label>
                  <input
                    id="ne-horas"
                    name="horas_semana"
                    type="number"
                    step="0.5"
                    min={0}
                    max={60}
                    defaultValue={40}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="ne-rol">Rol</label>
                <select id="ne-rol" name="rol" defaultValue="empleado">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ETIQUETA_ROL[r]}
                    </option>
                  ))}
                </select>
                <p className="mini suave" style={{ marginTop: 6 }}>
                  Trabajador: solo ficha y ve lo suyo. Encargado: además ve y corrige a la gente de
                  su centro. Administrador: todo.
                </p>
              </div>
            </Formulario>
          )}
        </div>

        {/* -------------------------------- Plantilla -------------------------------- */}
        <div className="tarjeta">
          <header>
            <h2>Plantilla</h2>
            <span className="mini suave">{perfiles.length}</span>
          </header>
          <div className="lista">
            {perfiles.map((p) => (
              <details key={p.id} style={{ padding: '12px 0' }}>
                <summary style={{ cursor: 'pointer' }}>
                  <strong>{p.nombre}</strong>{' '}
                  <span className="mini suave">
                    {ETIQUETA_ROL[p.rol]} · {p.horas_semana} h
                    {!p.activo && ' · inactivo'}
                    {!p.centro_id && ' · sin centro'}
                  </span>
                </summary>
                <div className="columna" style={{ marginTop: 12, gap: 16 }}>
                  <Formulario accion={guardarEmpleado} boton="Guardar">
                    <input type="hidden" name="id" value={p.id} />
                    <p className="mini suave">{p.email}</p>
                    <div>
                      <label htmlFor={`rol-${p.id}`}>Rol</label>
                      <select id={`rol-${p.id}`} name="rol" defaultValue={p.rol}>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ETIQUETA_ROL[r]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`centro-${p.id}`}>Centro</label>
                      <select id={`centro-${p.id}`} name="centro_id" defaultValue={p.centro_id ?? ''}>
                        <option value="">Sin asignar</option>
                        {centros.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`horas-${p.id}`}>Horas por semana</label>
                      <input
                        id={`horas-${p.id}`}
                        name="horas_semana"
                        type="number"
                        step="0.5"
                        min={0}
                        max={60}
                        defaultValue={p.horas_semana}
                      />
                    </div>
                    <label className="fila" style={{ gap: 8 }}>
                      <input
                        type="checkbox"
                        name="activo"
                        defaultChecked={p.activo}
                        style={{ width: 20, height: 20, minHeight: 20 }}
                      />
                      Cuenta activa
                    </label>
                  </Formulario>

                  {!sinServiceRole && (
                    <details>
                      <summary className="mini suave" style={{ cursor: 'pointer' }}>
                        Ha perdido la contraseña
                      </summary>
                      <div style={{ marginTop: 10 }}>
                        <Formulario
                          accion={restablecerPassword}
                          boton="Cambiar contraseña"
                          botonClase="btn"
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <CampoPassword
                            id={`pw-${p.id}`}
                            etiqueta="Contraseña nueva"
                            ayuda="La anterior deja de funcionar en cuanto guardes."
                          />
                        </Formulario>
                      </div>
                    </details>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
