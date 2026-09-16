import 'server-only'
import { createSign } from 'crypto'
import { sumarDias } from './fechas'

/**
 * Lectura del calendario de Google de la finca (cuenta de servicio, solo
 * lectura: el calendario se sigue gestionando a mano desde Google Calendar).
 * Si faltan las variables, la app sigue funcionando sin este apartado — igual
 * que arranca sin Supabase.
 */

export type EventoCalendario = {
  id: string
  titulo: string
  /** Fecha (todo el día) u hora de inicio, en ISO. */
  inicio: string
  fin: string
  todoElDia: boolean
  descripcion: string | null
  enlace: string
}

function configurado() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const clave = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  const calendarioId = process.env.GOOGLE_CALENDAR_ID
  if (!email || !clave || !calendarioId) return null
  return { email, clave: clave.replace(/\\n/g, '\n'), calendarioId }
}

function base64url(datos: Buffer) {
  return datos.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

let cache: { token: string; expira: number } | null = null

async function obtenerToken(email: string, clave: string): Promise<string> {
  if (cache && cache.expira > Date.now() + 30_000) return cache.token

  const ahora = Math.floor(Date.now() / 1000)
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        iss: email,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: ahora,
        exp: ahora + 3600,
      }),
    ),
  )
  const firma = base64url(createSign('RSA-SHA256').update(`${header}.${payload}`).sign(clave))
  const jwt = `${header}.${payload}.${firma}`

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error('No se ha podido autenticar con Google Calendar')
  const datos = (await resp.json()) as { access_token: string; expires_in: number }
  cache = { token: datos.access_token, expira: Date.now() + datos.expires_in * 1000 }
  return datos.access_token
}

/**
 * Eventos entre dos fechas (YYYY-MM-DD, inclusive). `null` si el calendario no
 * está configurado; lanza si Google da error (la página lo muestra como aviso,
 * nunca rompe el resto del panel).
 */
export async function eventosCalendario(
  desde: string,
  hasta: string,
): Promise<EventoCalendario[] | null> {
  const conf = configurado()
  if (!conf) return null

  const token = await obtenerToken(conf.email, conf.clave)
  const params = new URLSearchParams({
    timeMin: `${desde}T00:00:00Z`,
    timeMax: `${hasta}T23:59:59Z`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })
  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conf.calendarioId)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      // Se sincroniza solo cada 15 min: no hace falta más para un calendario
      // de finca, y evita pedirle a Google datos en cada visita a la página.
      next: { revalidate: 900 },
    },
  )
  if (!resp.ok) throw new Error('No se ha podido leer el calendario de Google')
  const datos = (await resp.json()) as {
    items: Array<{
      id: string
      summary?: string
      description?: string
      htmlLink: string
      start: { date?: string; dateTime?: string }
      end: { date?: string; dateTime?: string }
      status: string
    }>
  }

  return datos.items
    .filter((ev) => ev.status !== 'cancelled')
    .map((ev) => ({
      id: ev.id,
      titulo: ev.summary ?? '(Sin título)',
      inicio: ev.start.date ?? ev.start.dateTime ?? '',
      // Google da el fin de un evento de día completo como el día SIGUIENTE al
      // último (exclusivo). Se normaliza a inclusivo, igual que `hasta` en
      // ausencias, para no mostrar un día de más.
      fin: ev.end.date ? sumarDias(ev.end.date, -1) : (ev.end.dateTime ?? ''),
      todoElDia: Boolean(ev.start.date),
      descripcion: ev.description ?? null,
      enlace: ev.htmlLink,
    }))
}
