import type { MetadataRoute } from 'next'
import { demoActiva, supabaseConfigurado } from '@/lib/supabase/configurado'

/**
 * Manifest de la PWA. El punto de entrada depende del despliegue: si Supabase
 * todavía no está configurado, la app instalada abre directamente la demo.
 */
export default function manifest(): MetadataRoute.Manifest {
  const inicio = supabaseConfigurado || !demoActiva ? '/fichar' : '/demo/fichar'

  return {
    name: 'Fichajes SKYRANCH',
    short_name: 'Fichajes',
    description: 'Registro de jornada con ubicación, turnos e informes',
    id: '/',
    start_url: inicio,
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f7f9',
    theme_color: '#1f6feb',
    lang: 'es',
    dir: 'ltr',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Fichar', url: inicio },
      { name: 'Mi horario', url: supabaseConfigurado ? '/turnos' : '/demo/turnos' },
    ],
  }
}
