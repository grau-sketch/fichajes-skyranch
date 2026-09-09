'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDemo } from '@/components/DemoProvider'

/**
 * Barra de la demo: recuerda que los datos son inventados, permite cambiar de
 * rol y volver al punto de partida.
 */
export default function CabeceraDemo() {
  const ruta = usePathname()
  const { reiniciar } = useDemo()
  const comoAdmin = ruta.startsWith('/demo/admin')

  return (
    <div
      style={{
        background: 'var(--marca-suave)',
        borderBottom: '1px solid var(--linea)',
        padding: 'calc(8px + env(safe-area-inset-top)) 16px 8px',
      }}
    >
      <div
        className="columna"
        style={{ maxWidth: 'var(--max)', margin: '0 auto', gap: 8 }}
      >
        <div className="fila entre" style={{ gap: 10 }}>
          <div className="fila crece" style={{ gap: 6 }}>
            <Link
              href="/demo/fichar"
              className={`btn mini crece ${comoAdmin ? '' : 'primario'}`}
              aria-current={comoAdmin ? undefined : 'page'}
            >
              Trabajadora
            </Link>
            <Link
              href="/demo/admin"
              className={`btn mini crece ${comoAdmin ? 'primario' : ''}`}
              aria-current={comoAdmin ? 'page' : undefined}
            >
              Administrador
            </Link>
          </div>
          <button
            type="button"
            className="btn mini"
            onClick={() => {
              if (window.confirm('¿Volver a los datos de partida de la demo?')) reiniciar()
            }}
          >
            Reiniciar
          </button>
        </div>
        <p className="mini" style={{ color: 'var(--marca-oscuro)' }}>
          <strong>Demo</strong> · datos inventados, guardados solo en este navegador. Toca lo que
          quieras.
        </p>
      </div>
    </div>
  )
}
