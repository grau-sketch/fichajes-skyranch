'use client'

import Link from 'next/link'
import BuscadorDireccion from '@/components/BuscadorDireccion'
import CampoPassword from '@/components/CampoPassword'
import { useDemo } from '@/components/DemoProvider'
import Formulario from '@/components/Formulario'
import { ROLES, type Rol } from '@/lib/constants'
import {
  crearEmpleadoDemo,
  guardarCentroDemo,
  guardarEmpleadoDemo,
} from '@/lib/demoEstado'

const ETIQUETA_ROL = {
  admin: 'Administrador',
  encargado: 'Encargado',
  empleado: 'Trabajador',
} as const

const numeroONulo = (v: FormDataEntryValue | null) => {
  if (v === null || String(v).trim() === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const { centros, perfiles } = estado

  const datosCentro = (form: FormData) => ({
    id: form.get('id') ? String(form.get('id')) : undefined,
    nombre: String(form.get('nombre') ?? ''),
    direccion: String(form.get('direccion') ?? ''),
    lat: numeroONulo(form.get('lat')),
    lon: numeroONulo(form.get('lon')),
    radio_m: Number(form.get('radio_m') ?? 150),
  })

  return (
    <>
      <header className="cabecera">
        <div className="cabecera-inner">
          <div className="crece">
            <Link href="/demo/admin" className="mini suave">
              ← Volver
            </Link>
            <h1>Personal y centros</h1>
          </div>
        </div>
      </header>

      <main className="pagina">
        <div className="tarjeta">
          <header>
            <h2>Centros de trabajo</h2>
            <span className="mini suave">{centros.length}</span>
          </header>
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
                  <Formulario
                    boton="Guardar centro"
                    demo={(form) => aplicar((e) => guardarCentroDemo(e, datosCentro(form)))}
                  >
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

          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Nuevo centro</summary>
            <div style={{ marginTop: 12 }}>
              <Formulario
                boton="Crear centro"
                limpiarAlEnviar
                demo={(form) => aplicar((e) => guardarCentroDemo(e, datosCentro(form)))}
              >
                <div>
                  <label htmlFor="nc-nombre">Nombre</label>
                  <input id="nc-nombre" name="nombre" required placeholder="Local Sur" />
                </div>
                <BuscadorDireccion id="nuevo" />
              </Formulario>
            </div>
          </details>
        </div>

        <div className="tarjeta">
          <header>
            <h2>Dar de alta a un trabajador</h2>
          </header>
          {centros.length === 0 ? (
            <p className="nota aviso">Crea antes un centro para poder asignárselo.</p>
          ) : (
            <Formulario
              boton="Crear cuenta"
              limpiarAlEnviar
              demo={(form) =>
                aplicar((e) =>
                  crearEmpleadoDemo(e, {
                    nombre: String(form.get('nombre') ?? ''),
                    password: String(form.get('password') ?? ''),
                    rol: String(form.get('rol') ?? 'empleado') as Rol,
                    centro_id: String(form.get('centro_id') ?? ''),
                    horas_semana: Number(form.get('horas_semana') ?? 40),
                  }),
                )
              }
            >
              <div>
                <label htmlFor="ne-nombre">Nombre y apellido</label>
                <input
                  id="ne-nombre"
                  name="nombre"
                  required
                  minLength={5}
                  autoCapitalize="words"
                  placeholder="Gilenis Pérez"
                />
                <p className="mini suave" style={{ marginTop: 6 }}>
                  Esto es lo que escribirá para entrar. Da igual acentos o mayúsculas, pero el
                  nombre y el apellido tienen que coincidir.
                </p>
              </div>
              <CampoPassword id="ne-password" />
              <div className="campos dos">
                <div>
                  <label htmlFor="ne-centro">Centro</label>
                  <select id="ne-centro" name="centro_id" defaultValue={centros[0].id}>
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
                  <Formulario
                    boton="Guardar"
                    demo={(form) =>
                      aplicar((e) =>
                        guardarEmpleadoDemo(e, {
                          id: p.id,
                          rol: String(form.get('rol') ?? p.rol) as Rol,
                          centro_id: String(form.get('centro_id') ?? ''),
                          horas_semana: Number(form.get('horas_semana') ?? p.horas_semana),
                          activo: form.get('activo') === 'on',
                        }),
                      )
                    }
                  >
                    <p className="mini suave">Entra escribiendo: {p.nombre}</p>
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

                  <details>
                    <summary className="mini suave" style={{ cursor: 'pointer' }}>
                      Ha perdido la contraseña
                    </summary>
                    <div style={{ marginTop: 10 }}>
                      <Formulario
                        boton="Cambiar contraseña"
                        botonClase="btn"
                        demo={(form) =>
                          String(form.get('password') ?? '').length < 8
                            ? { error: 'La contraseña necesita al menos 8 caracteres' }
                            : { ok: 'Contraseña cambiada. Pásasela a la persona.' }
                        }
                      >
                        <CampoPassword
                          id={`pw-${p.id}`}
                          etiqueta="Contraseña nueva"
                          ayuda="La anterior deja de funcionar en cuanto guardes."
                        />
                      </Formulario>
                    </div>
                  </details>
                </div>
              </details>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
