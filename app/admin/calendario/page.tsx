import Link from 'next/link'
import { DIAS_SEMANA_CORTO, TZ } from '@/lib/constants'
import { diasEntre, finMes, formatFechaCorta, hoyLocal, inicioMes, sumarDias } from '@/lib/fechas'
import { eventosCalendario, type EventoCalendario } from '@/lib/googleCalendar'
import { requerirGestor } from '@/lib/sesion'

export const metadata = { title: 'Calendario' }
export const dynamic = 'force-dynamic'

const mesLargo = (fecha: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, month: 'long', year: 'numeric' }).format(
    new Date(`${fecha}T12:00:00Z`),
  )

const horaCorta = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
    new Date(ts),
  )

export default async function Calendario({
  searchParams,
}: {
  searchParams: { mes?: string }
}) {
  await requerirGestor()
  const hoy = hoyLocal()
  const ancla = /^\d{4}-\d{2}$/.test(searchParams.mes ?? '') ? `${searchParams.mes}-01` : hoy
  const desde = inicioMes(ancla)
  const hasta = finMes(ancla)
  const mesAnterior = sumarDias(desde, -1).slice(0, 7)
  const mesSiguiente = sumarDias(hasta, 1).slice(0, 7)

  let eventos: EventoCalendario[] | null = null
  let error = false
  try {
    eventos = await eventosCalendario(desde, hasta)
  } catch {
    error = true
  }

  if (!eventos && !error) {
    return (
      <main className="pagina">
        <div className="tarjeta">
          <header>
            <h2>Calendario</h2>
          </header>
          <p className="vacio">
            Este apartado todavía no está conectado a ningún calendario de Google. Faltan las
            variables de entorno del servidor.
          </p>
        </div>
      </main>
    )
  }

  // Un evento de varios días marca todos los días que ocupa en la rejilla, no
  // solo el primero.
  const porDia = new Map<string, EventoCalendario[]>()
  for (const ev of eventos ?? []) {
    const diaInicio = ev.inicio.slice(0, 10)
    const diaFin = ev.fin.slice(0, 10) || diaInicio
    const dias = ev.todoElDia ? Math.max(1, diasEntre(diaInicio, diaFin)) : 1
    for (let i = 0; i < dias; i++) {
      const dia = sumarDias(diaInicio, i)
      porDia.set(dia, [...(porDia.get(dia) ?? []), ev])
    }
  }

  const total = Number(hasta.slice(8, 10))
  const dias = Array.from({ length: total }, (_, i) => sumarDias(desde, i))
  const primerDow = new Date(`${desde}T12:00:00Z`).getUTCDay()
  const huecos = Array.from({ length: primerDow === 0 ? 6 : primerDow - 1 }, () => null)

  const ordenados = [...(eventos ?? [])].sort((a, b) => a.inicio.localeCompare(b.inicio))

  return (
    <main className="pagina">
      <div className="tarjeta">
        <div className="cal-nav">
          <Link href={`?mes=${mesAnterior}`} className="btn cal-flecha" aria-label="Mes anterior">
            ←
          </Link>
          <span className="titulo" style={{ textTransform: 'capitalize' }}>
            {mesLargo(ancla, TZ)}
          </span>
          <Link href={`?mes=${mesSiguiente}`} className="btn cal-flecha" aria-label="Mes siguiente">
            →
          </Link>
        </div>

        {error && (
          <p className="nota error" style={{ marginTop: 12 }}>
            No se ha podido leer el calendario de Google ahora mismo. Vuelve a intentarlo en unos
            minutos.
          </p>
        )}

        {!error && (
          <div className="cal-mes" style={{ marginTop: 14 }}>
            {DIAS_SEMANA_CORTO.slice(1)
              .concat(DIAS_SEMANA_CORTO[0])
              .map((d, i) => (
                <div key={`${d}-${i}`} className="cabeza">
                  {d}
                </div>
              ))}

            {huecos.map((_, i) => (
              <div key={`hueco-${i}`} className="cal-celda fuera" />
            ))}

            {dias.map((d) => {
              const delDia = porDia.get(d) ?? []
              return (
                <div key={d} className={`cal-celda ${delDia.length > 0 ? 'con-turno' : ''} ${d === hoy ? 'hoy' : ''}`}>
                  <span className="num">{Number(d.slice(8, 10))}</span>
                  {delDia.slice(0, 2).map((ev) => (
                    <span key={ev.id} className="rango">
                      {ev.titulo}
                    </span>
                  ))}
                  {delDia.length > 2 && <span className="rango">+{delDia.length - 2}</span>}
                </div>
              )
            })}
          </div>
        )}

        <p className="mini suave" style={{ marginTop: 12 }}>
          Se sincroniza solo con tu Google Calendar cada 15 minutos. Para cambiar un evento, hazlo
          directamente en Google Calendar.
        </p>
      </div>

      <div className="tarjeta">
        <header>
          <h2>Eventos del mes</h2>
          <span className="mini suave">{ordenados.length}</span>
        </header>
        {ordenados.length === 0 ? (
          <p className="vacio">Sin eventos este mes</p>
        ) : (
          <div className="lista">
            {ordenados.map((ev) => {
              const dias = ev.todoElDia
                ? diasEntre(ev.inicio.slice(0, 10), ev.fin.slice(0, 10) || ev.inicio.slice(0, 10))
                : 1
              return (
                <a
                  key={ev.id}
                  href={ev.enlace}
                  target="_blank"
                  rel="noreferrer"
                  className="columna"
                  style={{ gap: 4, padding: '12px 0' }}
                >
                  <div className="fila entre" style={{ gap: 8 }}>
                    <p style={{ fontWeight: 550 }}>{ev.titulo}</p>
                    <span className="mini suave mono">
                      {ev.todoElDia ? (
                        <>
                          {formatFechaCorta(ev.inicio)}
                          {dias > 1 && ` → ${formatFechaCorta(ev.fin)} · ${dias} días`}
                        </>
                      ) : (
                        <>
                          {formatFechaCorta(ev.inicio)} · {horaCorta(ev.inicio, TZ)}–
                          {horaCorta(ev.fin, TZ)}
                        </>
                      )}
                    </span>
                  </div>
                  {ev.descripcion && <p className="mini suave">{ev.descripcion}</p>}
                </a>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
