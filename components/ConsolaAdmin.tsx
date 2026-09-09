'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import AvisoBanner from '@/components/AvisoBanner'
import Marca from '@/components/Marca'
import type { Aviso } from '@/lib/types'

const ICONOS = {
  equipo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.6M18 14.8c1.6.8 2.6 2.4 2.6 4.4" />
    </svg>
  ),
  turnos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M8 3v3M16 3v3M3.5 9.5h17" />
    </svg>
  ),
  informes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 19V6M4 19h16" />
      <path d="M8 19v-5M12.5 19V9M17 19v-7" />
    </svg>
  ),
  ausencias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 6.5h16v13H4z" />
      <path d="M8 4v3M16 4v3" />
      <path d="M9 13.5l2 2 4-4" />
    </svg>
  ),
  personal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 21s7-4.6 7-10a7 7 0 1 0-14 0c0 5.4 7 10 7 10z" />
      <circle cx="12" cy="10.5" r="2.6" />
    </svg>
  ),
  fichar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
} as const

type Enlace = { href: string; texto: string; icono: keyof typeof ICONOS; globo?: number }

/**
 * Armazón de la consola de administración.
 *
 * En móvil se comporta como el resto de la app: barra superior y la barra
 * inferior de siempre. Desde 960 px aparece la barra lateral fija y el
 * contenido usa el ancho real de la pantalla — es la versión de ordenador.
 */
export default function ConsolaAdmin({
  nombre,
  esAdmin,
  avisos,
  ausenciasPendientes = 0,
  base = '',
  soloLectura = false,
  alMarcarAviso,
  children,
}: {
  nombre: string
  esAdmin: boolean
  avisos: Aviso[]
  ausenciasPendientes?: number
  base?: string
  soloLectura?: boolean
  alMarcarAviso?: (id: string) => void
  children: React.ReactNode
}) {
  const ruta = usePathname()
  const [abierta, setAbierta] = useState(false)

  const gestion: Enlace[] = [
    { href: `${base}/admin`, texto: 'Equipo', icono: 'equipo' },
    { href: `${base}/admin/turnos`, texto: 'Turnos', icono: 'turnos' },
    { href: `${base}/admin/ausencias`, texto: 'Ausencias', icono: 'ausencias', globo: ausenciasPendientes },
    { href: `${base}/admin/informes`, texto: 'Informes', icono: 'informes' },
  ]
  if (esAdmin) {
    gestion.push({ href: `${base}/admin/empleados`, texto: 'Personal y centros', icono: 'personal' })
  }

  const activo = (href: string) =>
    href === `${base}/admin` ? ruta === href : ruta.startsWith(href)

  const seccion = gestion.find((e) => activo(e.href))?.texto ?? 'Consola'

  return (
    <div className="consola">
      <aside className="consola-lateral">
        <Marca />
        <p className="seccion">Gestión</p>
        {gestion.map((e) => (
          <Link key={e.href} href={e.href} className={activo(e.href) ? 'activo' : ''}>
            {ICONOS[e.icono]}
            {e.texto}
            {e.globo ? <span className="globo">{e.globo}</span> : null}
          </Link>
        ))}

        {/* El administrador no ficha; el encargado sí, y necesita su horario. */}
        {!esAdmin && (
          <>
            <p className="seccion">Lo mío</p>
            <Link href={`${base}/fichar`} className={activo(`${base}/fichar`) ? 'activo' : ''}>
              {ICONOS.fichar}
              Fichar
            </Link>
            <Link href={`${base}/turnos`} className={activo(`${base}/turnos`) ? 'activo' : ''}>
              {ICONOS.turnos}
              Mi horario
            </Link>
          </>
        )}

        <div className="pie">
          <p className="mini suave truncar">{nombre}</p>
        </div>
      </aside>

      <div>
        <header className="consola-superior">
          <div className="consola-superior-inner">
            <div className="crece">
              <h1 style={{ fontSize: 22 }}>{seccion}</h1>
            </div>

            <div className="envoltorio-campana">
              <button
                type="button"
                className="campana"
                aria-label={`Avisos${avisos.length ? `: ${avisos.length} sin leer` : ''}`}
                aria-expanded={abierta}
                onClick={() => setAbierta((v) => !v)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5z" />
                  <path d="M10.3 19a2 2 0 0 0 3.4 0" />
                </svg>
                {avisos.length > 0 && <span className="cuenta">{avisos.length}</span>}
              </button>

              {abierta && (
                <div className="panel-avisos">
                  <div className="fila entre" style={{ marginBottom: 10 }}>
                    <h3>Avisos</h3>
                    <button type="button" className="btn mini" onClick={() => setAbierta(false)}>
                      Cerrar
                    </button>
                  </div>
                  {avisos.length === 0 ? (
                    <p className="vacio" style={{ padding: '18px 0' }}>
                      Nada pendiente
                    </p>
                  ) : (
                    <div className="columna" style={{ gap: 8 }}>
                      {avisos.map((a) => (
                        <AvisoBanner
                          key={a.id}
                          aviso={a}
                          soloLectura={soloLectura}
                          alMarcar={alMarcarAviso}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
