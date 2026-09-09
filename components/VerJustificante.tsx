'use client'

import { useState } from 'react'
import { urlJustificante } from '@/app/actions'

/**
 * Abre el justificante con una URL firmada de 2 minutos. El bucket es privado
 * porque puede haber un parte médico: nunca un enlace permanente.
 */
export default function VerJustificante({ ruta }: { ruta: string }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrir() {
    setCargando(true)
    setError(null)
    try {
      const r = await urlJustificante(ruta)
      if (r.ok) window.open(r.datos, '_blank', 'noopener,noreferrer')
      else setError(r.error)
    } catch {
      setError('No se ha podido abrir')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fila" style={{ gap: 8 }}>
      <button type="button" className="btn mini" onClick={abrir} disabled={cargando}>
        {cargando ? 'Abriendo…' : 'Ver justificante'}
      </button>
      {error && <span className="mini" style={{ color: 'var(--error)' }}>{error}</span>}
    </div>
  )
}
