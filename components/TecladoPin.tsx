'use client'

import { LONGITUD_PIN } from '@/lib/pin'

/** Teclado numérico grande: se usa con guantes y a contraluz. */
export default function TecladoPin({
  valor,
  onCambio,
  deshabilitado = false,
}: {
  valor: string
  onCambio: (v: string) => void
  deshabilitado?: boolean
}) {
  const pulsar = (d: string) => {
    if (deshabilitado || valor.length >= LONGITUD_PIN) return
    onCambio(valor + d)
  }

  return (
    <div className="columna" style={{ gap: 22, alignItems: 'center' }}>
      <div className="puntos-pin" role="status" aria-label={`${valor.length} de ${LONGITUD_PIN} cifras`}>
        {Array.from({ length: LONGITUD_PIN }, (_, i) => (
          <span key={i} className={i < valor.length ? 'lleno' : ''} />
        ))}
      </div>

      <div className="teclado-pin">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => pulsar(d)} disabled={deshabilitado}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => pulsar('0')} disabled={deshabilitado}>
          0
        </button>
        <button
          type="button"
          className="borrar"
          onClick={() => onCambio(valor.slice(0, -1))}
          disabled={deshabilitado || valor.length === 0}
          aria-label="Borrar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M20 6H9l-5 6 5 6h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z" />
            <path d="M17 9.5l-4 5M13 9.5l4 5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
