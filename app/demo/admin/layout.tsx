'use client'

import ConsolaAdmin from '@/components/ConsolaAdmin'
import { useDemo } from '@/components/DemoProvider'
import { marcarAvisoDemo } from '@/lib/demoEstado'

/** La misma consola que la app real, con los datos de la demo. */
export default function LayoutDemoAdmin({ children }: { children: React.ReactNode }) {
  const { estado, aplicar } = useDemo()
  const admin = estado.perfiles.find((p) => p.id === estado.admin)

  return (
    <ConsolaAdmin
      nombre={admin?.nombre ?? 'Administrador'}
      esAdmin
      base="/demo"
      avisos={estado.avisos.filter((a) => a.destinatario_id === estado.admin && a.leido_en === null)}
      ausenciasPendientes={estado.ausencias.filter((a) => a.estado === 'pendiente').length}
      alMarcarAviso={(id) => aplicar((e) => marcarAvisoDemo(e, id))}
    >
      {children}
    </ConsolaAdmin>
  )
}
