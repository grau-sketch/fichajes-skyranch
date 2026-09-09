'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Rol } from '@/lib/constants'

const ICONOS = {
  fichar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  jornadas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <path d="M8 3v3M16 3v3M3.5 9.5h17M8 13.5h3M8 17h6" />
    </svg>
  ),
  turnos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 19V6M4 19h16" />
      <path d="M8 19v-5M12.5 19V9M17 19v-7" />
    </svg>
  ),
  ausencias: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6.5h16v13H4z" />
      <path d="M8 4v3M16 4v3" />
      <path d="M9 13.5l2 2 4-4" />
    </svg>
  ),
  equipo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 20c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
      <path d="M16.5 6.2a3 3 0 0 1 0 5.6M18 14.8c1.6.8 2.6 2.4 2.6 4.4" />
    </svg>
  ),
} as const

export default function Nav({ rol, base = '' }: { rol: Rol; base?: string }) {
  const ruta = usePathname()
  if (ruta === '/login') return null

  // El administrador no ficha: gestiona. Su barra son las secciones de la
  // consola. El trabajador ve su horario y ficha; su histórico de fichajes no
  // se expone en la app (se entrega a petición desde Informes).
  const enlaces: { href: string; texto: string; icono: keyof typeof ICONOS }[] =
    rol === 'admin'
      ? [
          { href: `${base}/admin`, texto: 'Equipo', icono: 'equipo' },
          { href: `${base}/admin/turnos`, texto: 'Turnos', icono: 'jornadas' },
          { href: `${base}/admin/ausencias`, texto: 'Ausencias', icono: 'ausencias' },
          { href: `${base}/admin/informes`, texto: 'Informes', icono: 'turnos' },
        ]
      : [
          { href: `${base}/fichar`, texto: 'Fichar', icono: 'fichar' },
          { href: `${base}/turnos`, texto: 'Mi horario', icono: 'jornadas' },
        ]
  if (rol === 'encargado') {
    enlaces.push({ href: `${base}/admin`, texto: 'Equipo', icono: 'equipo' })
  }

  return (
    <nav className="nav">
      {enlaces.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className={ruta === e.href || ruta.startsWith(`${e.href}/`) ? 'activo' : ''}
          aria-current={ruta === e.href ? 'page' : undefined}
        >
          {ICONOS[e.icono]}
          {e.texto}
        </Link>
      ))}
    </nav>
  )
}
