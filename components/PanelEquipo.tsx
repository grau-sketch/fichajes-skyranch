import Link from 'next/link'
import AvisoBanner from '@/components/AvisoBanner'
import { ETIQUETA_ESTADO, type EstadoPresencia } from '@/lib/constants'
import { formatFechaCorta, formatMinutos, horaLocal } from '@/lib/fechas'
import type { Jornada } from '@/lib/jornada'
import type { Aviso, Turno } from '@/lib/types'

export type FilaEquipo = {
  id: string
  nombre: string
  estado: EstadoPresencia
  ultimoTs: string | null
  minutosHoy: number
  turnosHoy: Turno[]
  sinEntrada: boolean
  jornadaColgada: Jornada | null
  fueraDeRadio: boolean
}

/**
 * Estado del equipo ahora mismo. Lo usan el panel real y la demo, así que la
 * presentación vive aquí y las páginas solo calculan los datos.
 */
export default function PanelEquipo({
  filas,
  avisos,
  hoy,
  tz,
  esAdmin,
  ausenciasPendientes = 0,
  base = '',
  soloLectura = false,
  alMarcarAviso,
}: {
  filas: FilaEquipo[]
  avisos: Aviso[]
  hoy: string
  tz: string
  esAdmin: boolean
  /** Solicitudes de ausencia esperando decisión. */
  ausenciasPendientes?: number
  /** Prefijo de las rutas: '' en la app real, '/demo' en la demo. */
  base?: string
  soloLectura?: boolean
  alMarcarAviso?: (id: string) => void
}) {
  const dentro = filas.filter((f) => f.estado === 'dentro').length
  const enPausa = filas.filter((f) => f.estado === 'pausa').length
  const incidencias = filas.filter((f) => f.sinEntrada || f.jornadaColgada || f.fueraDeRadio)

  return (
    <>
      {/* En escritorio los avisos viven en la campana de la barra superior. */}
      {avisos.length > 0 && (
        <div className="columna solo-movil" style={{ gap: 8 }}>
          {avisos.map((a) => (
            <AvisoBanner
              key={a.id}
              aviso={a}
              soloLectura={soloLectura}
              alMarcar={alMarcarAviso}
            />
          ))}
        </div>
      )}

      <div className="metricas">
        <div>
          <p className="v mono">{dentro}</p>
          <p className="k">Trabajando</p>
        </div>
        <div>
          <p className="v mono">{enPausa}</p>
          <p className="k">En pausa</p>
        </div>
        <div>
          <p className="v mono">{incidencias.length}</p>
          <p className="k">A revisar</p>
        </div>
      </div>

      <div className="rejilla dos-uno">
      {incidencias.length > 0 && (
        <div className="tarjeta">
          <header>
            <h2>Requiere atención</h2>
          </header>
          <div className="lista">
            {incidencias.map((f) => (
              <div key={f.id} className="columna" style={{ gap: 4, padding: '10px 0' }}>
                <strong>{f.nombre}</strong>
                {f.sinEntrada && (
                  <span className="pequeno" style={{ color: 'var(--error)' }}>
                    No ha fichado la entrada (turno a las{' '}
                    {f.turnosHoy[0]?.hora_inicio.slice(0, 5)})
                  </span>
                )}
                {f.jornadaColgada && (
                  <span className="pequeno" style={{ color: 'var(--aviso)' }}>
                    Jornada abierta desde las {horaLocal(f.jornadaColgada.entrada, tz)}
                    {f.jornadaColgada.fecha !== hoy &&
                      ` del ${formatFechaCorta(f.jornadaColgada.fecha, tz)}`}
                  </span>
                )}
                {f.fueraDeRadio && (
                  <span className="pequeno" style={{ color: 'var(--aviso)' }}>
                    Ha fichado hoy fuera del radio del centro
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tarjeta">
        <header>
          <h2>Estado ahora</h2>
          <span className="mini suave">{filas.length} personas</span>
        </header>
        {filas.length === 0 ? (
          <p className="vacio">No hay personal asignado todavía</p>
        ) : (
          <div className="lista">
            {filas.map((f) => (
              <div key={f.id} className="item">
                <span
                  className={`pill ${
                    f.estado === 'dentro' ? 'ok' : f.estado === 'pausa' ? 'aviso' : ''
                  }`}
                  style={{ minWidth: 96 }}
                >
                  <span className="punto" />
                  {ETIQUETA_ESTADO[f.estado]}
                </span>
                <div className="crece">
                  <p className="truncar" style={{ fontWeight: 550 }}>
                    {f.nombre}
                  </p>
                  <p className="mini suave mono">
                    {f.turnosHoy.length > 0
                      ? f.turnosHoy
                          .map((t) => `${t.hora_inicio.slice(0, 5)}–${t.hora_fin.slice(0, 5)}`)
                          .join(', ')
                      : 'Sin turno hoy'}
                    {f.ultimoTs && ` · último ${horaLocal(f.ultimoTs, tz)}`}
                  </p>
                </div>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {formatMinutos(f.minutosHoy)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {/* En escritorio estos accesos están en la barra lateral. */}
      <div className="fila solo-movil" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Link className="btn crece" href={`${base}/admin/ausencias`}>
          Ausencias
          {ausenciasPendientes > 0 && (
            <span className="pill aviso" style={{ marginLeft: 2 }}>
              {ausenciasPendientes}
            </span>
          )}
        </Link>
        <Link className="btn crece" href={`${base}/admin/informes`}>
          Informes
        </Link>
        <Link className="btn crece" href={`${base}/admin/turnos`}>
          Planificar turnos
        </Link>
        {esAdmin && (
          <Link className="btn crece" href={`${base}/admin/empleados`}>
            Personal y centros
          </Link>
        )}
      </div>
    </>
  )
}
