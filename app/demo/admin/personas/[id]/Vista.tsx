'use client'

import { notFound } from 'next/navigation'
import { useDemo } from '@/components/DemoProvider'
import FichaPersona, { type ManejadoresFicha } from '@/components/FichaPersona'
import { resumenVacaciones } from '@/lib/ausencias'
import { TOLERANCIA_DESVIO_MIN, TZ, type Rol, type TipoAusencia } from '@/lib/constants'
import { finMes, hoyLocal, inicioMes } from '@/lib/fechas'
import {
  agruparJornadas,
  desviosDelDia,
  marcarDesvios,
  resumirJornadas,
} from '@/lib/jornada'
import {
  decidirAusenciaDemo,
  guardarPersonaDemo,
  solicitarAusenciaDemo,
} from '@/lib/demoEstado'

export default function Vista({ id }: { id: string }) {
  const { estado, aplicar } = useDemo()
  const hoy = hoyLocal(TZ)
  const anio = Number(hoy.slice(0, 4))
  const desdeMes = inicioMes(hoy)
  const hastaMes = finMes(hoy)

  const persona = estado.perfiles.find((p) => p.id === id)
  if (!persona) notFound()

  const ausencias = estado.ausencias
    .filter((a) => a.empleado_id === id && a.hasta >= `${anio}-01-01`)
    .sort((a, b) => b.desde.localeCompare(a.desde))
  const fichajes = estado.fichajes
    .filter((f) => f.empleado_id === id)
    .sort((a, b) => a.ts.localeCompare(b.ts))
  const turnos = estado.turnos.filter(
    (t) => t.empleado_id === id && t.fecha >= desdeMes && t.fecha <= hastaMes,
  )

  const jornadas = marcarDesvios(
    agruparJornadas(fichajes, new Date(), TZ).filter(
      (j) => j.fecha >= desdeMes && j.fecha <= hastaMes,
    ),
    turnos,
    TOLERANCIA_DESVIO_MIN,
    TZ,
  )

  const delMes = fichajes.filter((f) => f.ts >= `${desdeMes}T00:00:00`)

  const demo: ManejadoresFicha = {
    guardarPersona: (form) =>
      aplicar((e) =>
        guardarPersonaDemo(e, {
          id,
          nombre: String(form.get('nombre') ?? '').trim().replace(/\s+/g, ' '),
          rol: String(form.get('rol') ?? 'empleado') as Rol,
          centro_id: String(form.get('centro_id') ?? ''),
          horas_semana: Number(form.get('horas_semana') ?? 40),
          dias_vacaciones: Number(form.get('dias_vacaciones') ?? 30),
          fecha_nacimiento: String(form.get('fecha_nacimiento') ?? ''),
          telefono: String(form.get('telefono') ?? '').trim(),
          activo: form.get('activo') === 'on',
        }),
      ),
    // La contraseña vive en Supabase Auth: en la demo no hay nada que cambiar.
    restablecerPassword: () => ({
      ok: 'En la demo no hay contraseñas de verdad; en la app real se cambia aquí.',
    }),
    ausencias: {
      decidir: (form: FormData) =>
        aplicar((e) =>
          decidirAusenciaDemo(
            e,
            String(form.get('id')),
            String(form.get('estado')) as 'aprobada' | 'rechazada' | 'cancelada',
            String(form.get('nota') ?? ''),
            e.admin,
          ),
        ),
    },
    pedirAusencia: (form) =>
      aplicar((e) =>
        solicitarAusenciaDemo(e, {
          empleado_id: id,
          tipo: String(form.get('tipo')) as TipoAusencia,
          desde: String(form.get('desde')),
          hasta: String(form.get('hasta')),
          motivo: String(form.get('motivo') ?? ''),
          justificante: String(form.get('justificante') ?? '') || null,
          comoGestor: true,
        }),
      ),
  }

  return (
    <FichaPersona
      persona={persona}
      centros={estado.centros}
      ausencias={ausencias}
      vacaciones={resumenVacaciones(ausencias, persona.dias_vacaciones, anio)}
      mes={resumirJornadas(jornadas)}
      desvios={desviosDelDia(jornadas, turnos, TOLERANCIA_DESVIO_MIN, TZ)}
      hayTurnos={turnos.length > 0}
      ultimoFichaje={delMes.length > 0 ? delMes[delMes.length - 1].ts : null}
      anio={anio}
      tz={TZ}
      esAdmin
      base="/demo"
      demo={demo}
    />
  )
}
