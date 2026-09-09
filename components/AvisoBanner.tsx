'use client'

import { useState } from 'react'
import { marcarAvisoLeido } from '@/app/actions'
import type { Aviso } from '@/lib/types'

const TONO: Record<string, string> = {
  sin_entrada: 'error',
  jornada_abierta: 'aviso',
  turno_sin_fichar: 'aviso',
  fichaje_fuera_radio: 'aviso',
  fichaje_corregido: 'info',
  resumen_encargado: 'info',
}

export default function AvisoBanner({
  aviso,
  soloLectura = false,
  alMarcar,
}: {
  aviso: Aviso
  soloLectura?: boolean
  /** Manejador local de la demo; si no se pasa, se llama a la Server Action. */
  alMarcar?: (id: string) => void
}) {
  const [oculto, setOculto] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  if (oculto) return null

  async function marcar() {
    setOcupado(true)
    if (alMarcar) {
      alMarcar(aviso.id)
      setOculto(true)
      return
    }
    const r = await marcarAvisoLeido(aviso.id)
    if (r.ok) setOculto(true)
    else setOcupado(false)
  }

  return (
    <div className={`nota ${TONO[aviso.tipo] ?? 'info'} fila`} style={{ gap: 10 }}>
      <div className="crece">
        <strong>{aviso.titulo}</strong>
        <p className="pequeno" style={{ marginTop: 2 }}>
          {aviso.cuerpo}
        </p>
      </div>
      {!soloLectura && (
        <button
          type="button"
          className="btn mini"
          onClick={marcar}
          disabled={ocupado}
          aria-label="Marcar como visto"
        >
          {ocupado ? '…' : 'Visto'}
        </button>
      )}
    </div>
  )
}
