import { notFound } from 'next/navigation'
import CabeceraDemo from '@/components/CabeceraDemo'
import { DemoProvider } from '@/components/DemoProvider'
import Nav from '@/components/Nav'
import { demoActiva } from '@/lib/supabase/configurado'

/**
 * Demo con datos inventados: la app entera funcionando sin base de datos, para
 * poder probarla en el móvil (incluido el GPS real) antes de montar Supabase.
 * Todo lo que se toca se guarda en el navegador (localStorage).
 * Se puede apagar con NEXT_PUBLIC_DEMO=off.
 */
export default function LayoutDemo({ children }: { children: React.ReactNode }) {
  if (!demoActiva) notFound()

  return (
    <DemoProvider>
      <CabeceraDemo />
      {children}
      <Nav rol="admin" base="/demo" />
    </DemoProvider>
  )
}
