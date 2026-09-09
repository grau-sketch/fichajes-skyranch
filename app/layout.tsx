import type { Metadata, Viewport } from 'next'
import Nav from '@/components/Nav'
import RegistrarSW from '@/components/RegistrarSW'
import { supabaseConfigurado } from '@/lib/supabase/configurado'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Skyranch · Fichajes', template: '%s · Skyranch' },
  description: 'Registro de jornada de Skyranch: fichaje con ubicación, turnos e informes',
  applicationName: 'Skyranch',
  appleWebApp: { capable: true, title: 'Skyranch', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icono-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ed' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let rol: 'admin' | 'encargado' | 'empleado' | null = null

  if (supabaseConfigurado) {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
      rol = (data?.rol as typeof rol) ?? 'empleado'
    }
  }

  return (
    <html lang="es">
      <body>
        {children}
        {rol && <Nav rol={rol} />}
        <RegistrarSW />
      </body>
    </html>
  )
}
