import 'server-only'
import webpush from 'web-push'

let configurado = false

function configurar(): boolean {
  if (configurado) return true
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:avisos@example.com',
    publica,
    privada,
  )
  configurado = true
  return true
}

export type Suscripcion = { endpoint: string; p256dh: string; auth: string }

export type ResultadoEnvio = {
  enviados: number
  /** Endpoints que ya no existen: hay que borrarlos de la base. */
  caducados: string[]
}

export async function enviarPush(
  suscripciones: Suscripcion[],
  carga: { titulo: string; cuerpo: string; url?: string; tag?: string },
): Promise<ResultadoEnvio> {
  if (!configurar()) return { enviados: 0, caducados: [] }

  const cuerpo = JSON.stringify({
    titulo: carga.titulo,
    cuerpo: carga.cuerpo,
    url: carga.url ?? '/fichar',
    tag: carga.tag,
  })

  let enviados = 0
  const caducados: string[] = []

  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          cuerpo,
          { TTL: 3600, urgency: 'normal' },
        )
        enviados += 1
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode
        // 404/410: el navegador ya no tiene esa suscripción.
        if (codigo === 404 || codigo === 410) caducados.push(s.endpoint)
      }
    }),
  )

  return { enviados, caducados }
}
