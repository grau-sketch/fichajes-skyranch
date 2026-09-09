'use client'

import { useState } from 'react'
import { LOGO_SRC, MARCA_LUGAR, MARCA_NOMBRE } from '@/lib/constants'

/**
 * El sello grande, para la pantalla de acceso. Si el fichero del logo todavía
 * no está, dibuja un círculo con la inicial: nunca una imagen rota.
 */
export default function Sello({ tamano = 104 }: { tamano?: number }) {
  const [sinLogo, setSinLogo] = useState(false)

  if (LOGO_SRC && !sinLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_SRC}
        alt={MARCA_NOMBRE}
        width={tamano}
        height={tamano}
        style={{ borderRadius: '50%', margin: '0 auto', display: 'block' }}
        onError={() => setSinLogo(true)}
      />
    )
  }

  return (
    <div
      aria-label={MARCA_NOMBRE}
      style={{
        width: tamano,
        height: tamano,
        margin: '0 auto',
        borderRadius: '50%',
        background: 'var(--superficie-2)',
        border: '4px solid var(--marca)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--marca)',
        fontSize: tamano * 0.34,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}
      title={`${MARCA_NOMBRE} · ${MARCA_LUGAR}`}
    >
      SR
    </div>
  )
}
