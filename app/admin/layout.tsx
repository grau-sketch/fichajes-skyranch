import ConsolaAdmin from '@/components/ConsolaAdmin'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Aviso } from '@/lib/types'

/**
 * Envoltorio de toda la consola de administración. Aquí se cargan los datos
 * que la barra lateral y la campana necesitan en cualquier pantalla, para no
 * repetir la consulta en cada página.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const gestor = await requerirGestor()
  const supabase = createClient()

  const [resAvisos, resPendientes] = await Promise.all([
    supabase
      .from('avisos')
      .select('*')
      .eq('destinatario_id', gestor.id)
      .is('leido_en', null)
      .order('enviado_en', { ascending: false })
      .limit(20),
    supabase
      .from('ausencias')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
  ])

  return (
    <ConsolaAdmin
      nombre={gestor.nombre}
      esAdmin={gestor.rol === 'admin'}
      avisos={(resAvisos.data ?? []) as Aviso[]}
      ausenciasPendientes={resPendientes.count ?? 0}
    >
      {children}
    </ConsolaAdmin>
  )
}
