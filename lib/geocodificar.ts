import 'server-only'

export type Coordenadas = { lat: number; lon: number; etiqueta: string }

/**
 * Convierte una dirección en coordenadas con Nominatim (OpenStreetMap): sin
 * clave de API y gratis, a cambio de un límite de una consulta por segundo.
 * Solo se usa al dar de alta o editar un centro, así que sobra de largo.
 */
export async function geocodificar(direccion: string): Promise<Coordenadas | null> {
  const consulta = direccion.trim()
  if (consulta.length < 5) return null

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', consulta)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '0')

  try {
    const respuesta = await fetch(url, {
      headers: {
        // La política de uso de Nominatim exige identificarse.
        'User-Agent': 'app-fichajes/1.0 (registro de jornada)',
        'Accept-Language': 'es',
      },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    })
    if (!respuesta.ok) return null

    const datos = (await respuesta.json()) as {
      lat?: string
      lon?: string
      display_name?: string
    }[]
    const primero = datos[0]
    if (!primero?.lat || !primero.lon) return null

    const lat = Number(primero.lat)
    const lon = Number(primero.lon)
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null

    return { lat, lon, etiqueta: primero.display_name ?? consulta }
  } catch {
    return null
  }
}
