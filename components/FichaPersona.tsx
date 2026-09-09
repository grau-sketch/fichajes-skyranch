import Link from 'next/link'
import CampoPassword from '@/components/CampoPassword'
import Formulario, { type Respuesta } from '@/components/Formulario'
import ListaAusencias from '@/components/ListaAusencias'
import PedirAusencia from '@/components/PedirAusencia'
import { guardarPersona, restablecerPassword } from '@/app/actions'
import {
  DIAS_VACACIONES_MINIMO,
  ETIQUETA_ANOMALIA,
  ROLES,
  TOLERANCIA_DESVIO_MIN,
} from '@/lib/constants'
import { formatFechaCorta, formatHoras } from '@/lib/fechas'
import type { Desvio, ResumenJornadas } from '@/lib/jornada'
import type { Ausencia, Centro, Perfil } from '@/lib/types'
import { accesoDeNombre } from '@/lib/usuario'

export const ETIQUETA_ROL = {
  admin: 'Administrador',
  encargado: 'Encargado',
  empleado: 'Trabajador',
} as const

/** Manejadores locales de la demo, que sustituyen a las Server Actions. */
export type ManejadoresFicha = {
  guardarPersona: (form: FormData) => Respuesta
  restablecerPassword: (form: FormData) => Respuesta
  ausencias: React.ComponentProps<typeof ListaAusencias>['demo']
  pedirAusencia: (form: FormData) => { ok?: string; error?: string }
}

/**
 * Ficha de una persona: sus datos, su acceso, sus vacaciones y sus desvíos de
 * horario. La usan la consola real y la demo, así que la presentación vive aquí
 * y las páginas solo traen los datos.
 */
export default function FichaPersona({
  persona,
  centros,
  ausencias,
  vacaciones,
  mes,
  desvios,
  hayTurnos,
  ultimoFichaje,
  anio,
  tz,
  esAdmin,
  base = '',
  demo,
}: {
  persona: Perfil
  centros: Centro[]
  ausencias: Ausencia[]
  vacaciones: { total: number; usados: number; pendientes: number; restantes: number }
  mes: ResumenJornadas
  desvios: Desvio[]
  /** Si no hay turnos en el mes, no hay horario con el que comparar. */
  hayTurnos: boolean
  ultimoFichaje: string | null
  anio: number
  tz: string
  esAdmin: boolean
  base?: string
  demo?: ManejadoresFicha
}) {
  return (
    <main className="pagina">
      <div className="fila entre" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Link href={`${base}/admin`} className="mini suave">
            ← Equipo
          </Link>
          <h1 style={{ marginTop: 4 }}>{persona.nombre}</h1>
          <p className="pequeno suave">
            {ETIQUETA_ROL[persona.rol]} · {persona.horas_semana} h/semana
            {!persona.activo && ' · cuenta desactivada'}
          </p>
        </div>
        <Link className="btn" href={`${base}/admin/informes?empleado=${persona.id}`}>
          Ver su informe
        </Link>
      </div>

      <div className="metricas cuatro">
        <div>
          <p className="v mono">{formatHoras(mes.minutos_trabajados)}</p>
          <p className="k">Este mes</p>
        </div>
        <div>
          <p className="v mono">{mes.dias}</p>
          <p className="k">Días fichados</p>
        </div>
        <div>
          <p className="v mono">{vacaciones.restantes}</p>
          <p className="k">Vacaciones libres</p>
        </div>
        <div>
          <p className="v mono">{mes.con_anomalias}</p>
          <p className="k">A revisar</p>
        </div>
      </div>

      <div className="rejilla dos">
        <div className="tarjeta">
          <header>
            <h2>Ficha</h2>
          </header>

          {!esAdmin ? (
            <p className="nota">Solo un administrador puede editar la ficha.</p>
          ) : (
            <Formulario
              accion={guardarPersona}
              demo={demo?.guardarPersona}
              boton="Guardar ficha"
            >
              <input type="hidden" name="id" value={persona.id} />

              <div>
                <label htmlFor="nombre">Nombre y apellido</label>
                <input
                  id="nombre"
                  name="nombre"
                  defaultValue={persona.nombre}
                  required
                  minLength={5}
                  autoCapitalize="words"
                />
                <p className="mini suave" style={{ marginTop: 6 }}>
                  Es lo que escribe para entrar. Si lo cambias, cambia su acceso: tendrá que
                  escribir el nombre nuevo.
                </p>
              </div>

              <div className="campos dos">
                <div>
                  <label htmlFor="nacimiento">Fecha de nacimiento</label>
                  <input
                    id="nacimiento"
                    name="fecha_nacimiento"
                    type="date"
                    defaultValue={persona.fecha_nacimiento ?? ''}
                  />
                </div>
                <div>
                  <label htmlFor="telefono">Teléfono</label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    inputMode="tel"
                    defaultValue={persona.telefono ?? ''}
                    placeholder="600 000 000"
                  />
                </div>
              </div>

              <div className="campos dos">
                <div>
                  <label htmlFor="rol">Rol</label>
                  <select id="rol" name="rol" defaultValue={persona.rol}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ETIQUETA_ROL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="centro">Centro</label>
                  <select id="centro" name="centro_id" defaultValue={persona.centro_id ?? ''}>
                    <option value="">Sin asignar</option>
                    {centros.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="campos dos">
                <div>
                  <label htmlFor="horas">Horas por semana</label>
                  <input
                    id="horas"
                    name="horas_semana"
                    type="number"
                    step="0.5"
                    min={0}
                    max={60}
                    defaultValue={persona.horas_semana}
                  />
                </div>
                <div>
                  <label htmlFor="vacaciones">Días de vacaciones al año</label>
                  <input
                    id="vacaciones"
                    name="dias_vacaciones"
                    type="number"
                    min={0}
                    max={60}
                    defaultValue={persona.dias_vacaciones}
                  />
                </div>
              </div>

              <label className="fila" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  name="activo"
                  defaultChecked={persona.activo}
                  style={{ width: 20, height: 20, minHeight: 20 }}
                />
                Cuenta activa
              </label>
            </Formulario>
          )}
        </div>

        <div className="columna" style={{ gap: 18 }}>
          <div className="tarjeta">
            <header>
              <h2>Acceso</h2>
            </header>
            <p className="pequeno" style={{ marginBottom: 8 }}>
              Entra escribiendo <strong>{persona.nombre}</strong> y su contraseña.
            </p>
            <p className="mini suave" style={{ marginBottom: 14 }}>
              Identificador interno: <code>{accesoDeNombre(persona.nombre)}</code>. No es un buzón
              y no se le manda ningún correo.
            </p>

            {esAdmin && (
              <details>
                <summary className="desplegable">Cambiar su contraseña</summary>
                <div style={{ marginTop: 12 }}>
                  <Formulario
                    accion={restablecerPassword}
                    demo={demo?.restablecerPassword}
                    boton="Cambiar contraseña"
                    botonClase="btn"
                  >
                    <input type="hidden" name="id" value={persona.id} />
                    <CampoPassword
                      id={`pw-${persona.id}`}
                      etiqueta="Contraseña nueva"
                      ayuda="La anterior deja de funcionar al guardar. Apúntala y pásasela."
                    />
                  </Formulario>
                </div>
              </details>
            )}

            <p className="mini suave" style={{ marginTop: 14 }}>
              El PIN de acceso rápido lo pone cada persona en su propio móvil, en la pantalla de
              fichar. No se puede poner desde aquí: se guarda cifrado en ese teléfono y no sale de
              él. Si alguien lo olvida, cierra sesión y vuelve a entrar con su contraseña.
            </p>
          </div>

          <div className="tarjeta">
            <header>
              <h2>Vacaciones {anio}</h2>
              <span className="pill marca mono">{vacaciones.restantes} libres</span>
            </header>
            <div className="metricas" style={{ boxShadow: 'none' }}>
              <div>
                <p className="v mono">{vacaciones.total}</p>
                <p className="k">Del año</p>
              </div>
              <div>
                <p className="v mono">{vacaciones.usados}</p>
                <p className="k">Disfrutados</p>
              </div>
              <div>
                <p className="v mono">{vacaciones.pendientes}</p>
                <p className="k">Por aprobar</p>
              </div>
            </div>
            <p className="mini suave" style={{ marginTop: 12 }}>
              El mínimo legal son {DIAS_VACACIONES_MINIMO} días naturales al año. Se cambia en la
              ficha, a la izquierda.
            </p>
          </div>
        </div>
      </div>

      <div className="tarjeta">
        <header>
          <h2>Horario · desvíos del mes</h2>
          <span className="mini suave">margen de {TOLERANCIA_DESVIO_MIN} min</span>
        </header>
        {desvios.length === 0 ? (
          <p className="vacio">
            {hayTurnos
              ? 'Ha fichado dentro de su horario todo el mes'
              : 'No tiene turnos planificados este mes, así que no hay horario con el que comparar'}
          </p>
        ) : (
          <div className="lista">
            {desvios.map((d, i) => (
              <div key={`${d.fecha}-${d.tipo}-${i}`} className="item">
                <span className="mono mini suave" style={{ minWidth: 84 }}>
                  {formatFechaCorta(`${d.fecha}T12:00:00`, tz)}
                </span>
                <div className="crece">
                  <p style={{ fontWeight: 550 }}>{ETIQUETA_ANOMALIA[d.tipo]}</p>
                  <p className="mini suave mono">Previsto a las {d.prevista}</p>
                </div>
                <span
                  className={`pill ${
                    d.tipo === 'entrada_tarde' || d.tipo === 'salida_pronto' ? 'aviso' : ''
                  }`}
                >
                  {d.minutos} min
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mini suave" style={{ marginTop: 12 }}>
          Entrar antes o salir después no es un incumplimiento: puede ser tiempo de más que
          conviene mirar. Para cuadrar una hora concreta, corrige el fichaje desde Informes.
        </p>
      </div>

      <div className="tarjeta">
        <header>
          <h2>Ausencias</h2>
          <span className="mini suave">{ausencias.length} este año</span>
        </header>
        <ListaAusencias ausencias={ausencias} puedeDecidir demo={demo?.ausencias} />

        <details style={{ marginTop: 16 }}>
          <summary className="desplegable">Registrar una ausencia</summary>
          <div style={{ marginTop: 14 }}>
            <PedirAusencia empleadoId={persona.id} comoGestor demo={demo?.pedirAusencia} />
          </div>
        </details>
      </div>

      <p className="mini suave">
        {ultimoFichaje
          ? `Último fichaje: ${formatFechaCorta(ultimoFichaje, tz)}.`
          : 'Todavía no ha fichado este mes.'}{' '}
        El registro completo se guarda cuatro años y se descarga desde Informes.
      </p>
    </main>
  )
}
