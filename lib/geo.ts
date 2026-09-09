/** Distancia en metros entre dos coordenadas (Haversine, radio 6 371 008 m). */
export function distanciaM(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
): number {
  const R = 6371008
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type Posicion = { lat: number; lon: number; precision_m: number }

/**
 * Pide la posición al navegador. No lanza: devuelve el motivo del fallo para
 * poder fichar igualmente (el fichaje queda marcado como sin ubicación).
 */
export function pedirPosicion(
  timeoutMs = 12000,
): Promise<{ pos: Posicion } | { error: string }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ error: 'Este dispositivo no permite geolocalización' })
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          pos: {
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            precision_m: Math.round(p.coords.accuracy),
          },
        }),
      (err) => {
        const motivos: Record<number, string> = {
          1: 'Has denegado el permiso de ubicación',
          2: 'No se ha podido determinar la ubicación',
          3: 'La ubicación ha tardado demasiado',
        }
        resolve({ error: motivos[err.code] ?? 'Error de ubicación' })
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}

export function formatearDistancia(m: number | null): string {
  if (m === null) return '—'
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1)} km`
}
