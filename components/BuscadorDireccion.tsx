'use client'

import { useState } from 'react'
import { buscarCoordenadas } from '@/app/actions'
import { RADIO_DEFECTO_M } from '@/lib/constants'

/**
 * Los campos de dirección y coordenadas de un centro. El administrador escribe
 * la dirección y pulsa Buscar, o pulsa "Estoy aquí" si está dentro del local:
 * no tiene que ir a Google Maps a copiar números.
 */
export default function BuscadorDireccion({
  id,
  direccion = '',
  lat = null,
  lon = null,
  radio = RADIO_DEFECTO_M,
}: {
  id: string
  direccion?: string
  lat?: number | null
  lon?: number | null
  radio?: number
}) {
  const [valores, setValores] = useState({
    direccion,
    lat: lat === null ? '' : String(lat),
    lon: lon === null ? '' : String(lon),
  })
  const [estado, setEstado] = useState<{ tono: 'ok' | 'error' | 'aviso'; texto: string } | null>(
    null,
  )
  const [buscando, setBuscando] = useState(false)

  async function buscar() {
    setBuscando(true)
    setEstado(null)
    try {
      const r = await buscarCoordenadas(valores.direccion)
      if (r.ok) {
        setValores((v) => ({ ...v, lat: r.datos.lat.toFixed(6), lon: r.datos.lon.toFixed(6) }))
        setEstado({ tono: 'ok', texto: `Encontrado: ${r.datos.etiqueta}` })
      } else {
        setEstado({ tono: 'error', texto: r.error })
      }
    } catch {
      setEstado({ tono: 'error', texto: 'No se ha podido buscar la dirección' })
    } finally {
      setBuscando(false)
    }
  }

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setEstado({ tono: 'error', texto: 'Este dispositivo no da la ubicación' })
      return
    }
    setEstado({ tono: 'aviso', texto: 'Localizando…' })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setValores((v) => ({
          ...v,
          lat: p.coords.latitude.toFixed(6),
          lon: p.coords.longitude.toFixed(6),
        }))
        setEstado({
          tono: 'ok',
          texto: `Coordenadas tomadas aquí (±${Math.round(p.coords.accuracy)} m)`,
        })
      },
      () => setEstado({ tono: 'error', texto: 'No se ha podido obtener la ubicación' }),
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const sinCoordenadas = !valores.lat || !valores.lon

  return (
    <>
      <div>
        <label htmlFor={`dir-${id}`}>Dirección del centro</label>
        <input
          id={`dir-${id}`}
          name="direccion"
          value={valores.direccion}
          onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
          placeholder="Calle Mayor 12, Madrid"
        />
      </div>

      <div className="fila" style={{ gap: 8 }}>
        <button
          type="button"
          className="btn crece"
          onClick={buscar}
          disabled={buscando || valores.direccion.trim().length < 5}
        >
          {buscando ? 'Buscando…' : 'Buscar en el mapa'}
        </button>
        <button type="button" className="btn crece" onClick={usarMiUbicacion}>
          Estoy aquí
        </button>
      </div>

      {estado && <p className={`nota ${estado.tono}`}>{estado.texto}</p>}

      <details>
        <summary className="mini suave" style={{ cursor: 'pointer' }}>
          Coordenadas {sinCoordenadas ? '(sin definir)' : `${valores.lat}, ${valores.lon}`}
        </summary>
        <div className="campos dos" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor={`lat-${id}`}>Latitud</label>
            <input
              id={`lat-${id}`}
              name="lat"
              type="number"
              step="any"
              value={valores.lat}
              onChange={(e) => setValores((v) => ({ ...v, lat: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor={`lon-${id}`}>Longitud</label>
            <input
              id={`lon-${id}`}
              name="lon"
              type="number"
              step="any"
              value={valores.lon}
              onChange={(e) => setValores((v) => ({ ...v, lon: e.target.value }))}
            />
          </div>
        </div>
      </details>

      <div>
        <label htmlFor={`radio-${id}`}>Radio permitido (metros)</label>
        <input
          id={`radio-${id}`}
          name="radio_m"
          type="number"
          min={25}
          max={5000}
          defaultValue={radio}
        />
        <p className="mini suave" style={{ marginTop: 6 }}>
          Se puede fichar desde fuera de este radio; lo que pasa es que el fichaje se marca y te
          llega un aviso.
        </p>
      </div>
    </>
  )
}
