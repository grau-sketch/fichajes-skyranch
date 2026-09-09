'use client'

import { useState } from 'react'
import { LOGO_SRC, MARCA_LUGAR, MARCA_NOMBRE } from '@/lib/constants'

/**
 * El sello de SKYRANCH, arriba de todo. Si el fichero del logo no está
 * (o falla), cae al nombre escrito, así que nunca deja un hueco roto.
 */
export default function Marca({ conLugar = true }: { conLugar?: boolean }) {
  const [sinLogo, setSinLogo] = useState(false)
  const mostrarLogo = Boolean(LOGO_SRC) && !sinLogo

  return (
    <div className="marca">
      {mostrarLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_SRC!} alt="" onError={() => setSinLogo(true)} />
      )}
      <span className="marca-texto">
        <span className="nombre">{MARCA_NOMBRE}</span>
        {conLugar && <span className="lugar">{MARCA_LUGAR}</span>}
      </span>
    </div>
  )
}
