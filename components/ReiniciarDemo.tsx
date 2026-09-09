'use client'

import { useDemo } from '@/components/DemoProvider'

/** Vuelve la demo a los datos de partida. Discreto a propósito. */
export default function ReiniciarDemo() {
  const { reiniciar } = useDemo()

  return (
    <button
      type="button"
      className="mini suave"
      style={{
        background: 'none',
        border: 'none',
        textDecoration: 'underline',
        cursor: 'pointer',
        padding: 4,
        minHeight: 0,
        font: 'inherit',
        fontSize: 12,
        color: 'var(--texto-suave)',
      }}
      onClick={() => {
        if (window.confirm('¿Volver a los datos de partida de la demo?')) reiniciar()
      }}
    >
      Reiniciar datos de la demo
    </button>
  )
}
