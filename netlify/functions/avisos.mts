import type { Config } from '@netlify/functions'

/**
 * Tarea programada de avisos: el equivalente en Netlify al cron de Vercel.
 * Cada 15 minutos llama a /api/cron/avisos, que es quien tiene la lógica.
 *
 * Necesita CRON_SECRET en las variables de entorno del sitio. Sin ella no hace
 * nada, para no dejar el endpoint abierto.
 */
export default async () => {
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    console.warn('avisos: falta CRON_SECRET, no se ejecuta nada')
    return new Response('Falta CRON_SECRET', { status: 500 })
  }

  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL
  if (!base) {
    console.warn('avisos: no se conoce la URL del sitio')
    return new Response('Sin URL del sitio', { status: 500 })
  }

  const respuesta = await fetch(`${base}/api/cron/avisos`, {
    headers: { Authorization: `Bearer ${secreto}` },
  })
  const cuerpo = await respuesta.text()

  console.log(`avisos: ${respuesta.status} ${cuerpo}`)
  return new Response(cuerpo, { status: respuesta.status })
}

export const config: Config = {
  schedule: '*/15 * * * *',
}
