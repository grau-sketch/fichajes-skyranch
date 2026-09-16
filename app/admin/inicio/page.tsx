import Link from 'next/link'
import { TZ } from '@/lib/constants'
import { formatFechaLarga, hoyLocal } from '@/lib/fechas'
import { eventosCalendario, type EventoCalendario } from '@/lib/googleCalendar'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Ausencia, EstadoActual, Perfil } from '@/lib/types'

export const metadata = { title: 'Inicio' }
export const dynamic = 'force-dynamic'

const horaCorta = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
    new Date(ts),
  )

/**
 * Resumen del día para el responsable: de un vistazo, sin sustituir a Equipo
 * (estado detallado, con incidencias) ni a Calendario (mes completo).
 */
export default async function Inicio() {
  const gestor = await requerirGestor()
  const supabase = createClient()
  const hoy = hoyLocal()

  const [resPerfiles, resEstado, resAvisos, resAusencias] = await Promise.all([
    supabase.from('perfiles').select('*').eq('activo', true),
    supabase.from('estado_actual').select('*'),
    supabase
      .from('avisos')
      .select('*')
      .eq('destinatario_id', gestor.id)
      .is('leido_en', null),
    supabase.from('ausencias').select('*').eq('estado', 'pendiente'),
  ])

  const perfiles = ((resPerfiles.data ?? []) as Perfil[]).filter((p) => p.rol !== 'admin')
  const estados = (resEstado.data ?? []) as EstadoActual[]
  const avisosSinLeer = resAvisos.data?.length ?? 0
  const ausenciasPendientes = ((resAusencias.data ?? []) as Ausencia[]).length

  const porId = new Map(estados.map((e) => [e.empleado_id, e]))
  const trabajando = perfiles.filter((p) => porId.get(p.id)?.estado === 'dentro')
  const enPausa = perfiles.filter((p) => porId.get(p.id)?.estado === 'pausa')

  let eventosHoy: EventoCalendario[] | null = null
  try {
    eventosHoy = await eventosCalendario(hoy, hoy)
  } catch {
    eventosHoy = null
  }

  return (
    <main className="pagina">
      <div className="tarjeta">
        <header>
          <h2 style={{ textTransform: 'capitalize' }}>{formatFechaLarga(hoy, TZ)}</h2>
        </header>

        <div className="metricas">
          <div>
            <p className="v mono">{trabajando.length}</p>
            <p className="k">Trabajando</p>
          </div>
          <div>
            <p className="v mono">{enPausa.length}</p>
            <p className="k">En pausa</p>
          </div>
          <div>
            <p className="v mono">{perfiles.length - trabajando.length - enPausa.length}</p>
            <p className="k">Fuera</p>
          </div>
        </div>

        {trabajando.length + enPausa.length > 0 && (
          <div className="lista" style={{ marginTop: 8 }}>
            {[...trabajando, ...enPausa].map((p) => {
              const e = porId.get(p.id)
              return (
                <div key={p.id} className="fila entre" style={{ padding: '8px 0' }}>
                  <span>{p.nombre}</span>
                  <span className={`pill ${e?.estado === 'dentro' ? 'ok' : 'aviso'}`}>
                    {e?.estado === 'dentro' ? 'Trabajando' : 'En pausa'}
                    {e?.ultimo_ts && ` · ${horaCorta(e.ultimo_ts, TZ)}`}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <Link href="/admin" className="mini" style={{ display: 'inline-block', marginTop: 12 }}>
          Ver equipo completo →
        </Link>
      </div>

      <div className="tarjeta">
        <header>
          <h2>Hoy en el calendario</h2>
        </header>
        {eventosHoy === null ? (
          <p className="vacio">Calendario no disponible ahora mismo</p>
        ) : eventosHoy.length === 0 ? (
          <p className="vacio">Sin eventos para hoy</p>
        ) : (
          <div className="lista">
            {eventosHoy.map((ev) => (
              <div key={ev.id} className="fila entre" style={{ padding: '8px 0', gap: 8 }}>
                <span>{ev.titulo}</span>
                {!ev.todoElDia && (
                  <span className="mini suave mono">{horaCorta(ev.inicio, TZ)}</span>
                )}
              </div>
            ))}
          </div>
        )}
        <Link href="/admin/calendario" className="mini" style={{ display: 'inline-block', marginTop: 12 }}>
          Ver calendario completo →
        </Link>
      </div>

      {(avisosSinLeer > 0 || ausenciasPendientes > 0) && (
        <div className="tarjeta">
          <header>
            <h2>Pendiente de ti</h2>
          </header>
          <div className="columna" style={{ gap: 8 }}>
            {avisosSinLeer > 0 && (
              <p>
                <strong>{avisosSinLeer}</strong> {avisosSinLeer === 1 ? 'aviso sin leer' : 'avisos sin leer'}
              </p>
            )}
            {ausenciasPendientes > 0 && (
              <p>
                <Link href="/admin/ausencias">
                  <strong>{ausenciasPendientes}</strong>{' '}
                  {ausenciasPendientes === 1
                    ? 'solicitud de ausencia esperando'
                    : 'solicitudes de ausencia esperando'}
                </Link>
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
