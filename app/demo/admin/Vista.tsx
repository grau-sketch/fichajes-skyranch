'use client'

import { useDemo } from '@/components/DemoProvider'
import PanelEquipo, { type FilaEquipo } from '@/components/PanelEquipo'
import {
  TOLERANCIA_ENTRADA_MIN,
  TOLERANCIA_SALIDA_MIN,
  TZ,
  estadoDesdeUltimo,
  type TipoFichaje,
} from '@/lib/constants'
import { diasAusentes } from '@/lib/ausencias'
import { HOY } from '@/lib/demo'
import { marcarAvisoDemo } from '@/lib/demoEstado'
import { finTurno, hoyLocal, instanteLocal } from '@/lib/fechas'
import { agruparJornadas } from '@/lib/jornada'

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const ahora = new Date()
  // La demo arranca con datos sembrados "hoy"; si el navegador los guardó ayer,
  // el día real manda para que los cálculos sigan siendo coherentes.
  const hoy = hoyLocal(TZ) === HOY ? HOY : hoyLocal(TZ)

  const admin = estado.perfiles.find((p) => p.id === estado.admin)!

  const filas: FilaEquipo[] = estado.perfiles
    .filter((p) => p.id !== admin.id && p.activo)
    .map((p) => {
      const suyos = estado.fichajes.filter((f) => f.empleado_id === p.id)
      const jornadas = agruparJornadas(suyos, ahora, TZ)
      const deHoy = jornadas.filter((j) => j.fecha === hoy)
      const turnosHoy = estado.turnos
        .filter((t) => t.empleado_id === p.id && t.fecha === hoy && t.estado !== 'cancelado')
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

      const vigentes = suyos.filter((f) => f.anulado_en === null)
      const ultimo = [...vigentes].sort((a, b) => b.ts.localeCompare(a.ts))[0]

      const deAusencia =
        diasAusentes(
          estado.ausencias.filter((a) => a.empleado_id === p.id),
          hoy,
          hoy,
        ).size > 0

      const primerTurno = turnosHoy[0]
      const sinEntrada =
        Boolean(primerTurno) &&
        !deAusencia &&
        deHoy.length === 0 &&
        ahora.getTime() - instanteLocal(hoy, primerTurno!.hora_inicio, TZ).getTime() >
          TOLERANCIA_ENTRADA_MIN * 60000

      const ultimoTurno = turnosHoy[turnosHoy.length - 1]
      const jornadaColgada =
        jornadas.find((j) => j.abierta && j.fecha !== hoy) ??
        (ultimoTurno &&
        deHoy.some((j) => j.abierta) &&
        ahora.getTime() -
          finTurno(hoy, ultimoTurno.hora_inicio, ultimoTurno.hora_fin, TZ).getTime() >
          TOLERANCIA_SALIDA_MIN * 60000
          ? deHoy.find((j) => j.abierta)
          : undefined)

      return {
        id: p.id,
        nombre: p.nombre,
        estado: estadoDesdeUltimo((ultimo?.tipo as TipoFichaje) ?? null),
        ultimoTs: ultimo?.ts ?? null,
        minutosHoy: deHoy.reduce((s, j) => s + j.minutos_trabajados, 0),
        turnosHoy,
        sinEntrada,
        jornadaColgada: jornadaColgada ?? null,
        fueraDeRadio: suyos.some(
          (f) => f.dentro_radio === false && f.ts >= `${hoy}T00:00:00`,
        ),
      }
    })

  const avisos = estado.avisos.filter(
    (a) => a.destinatario_id === admin.id && a.leido_en === null,
  )

  return (
    <>

      <main className="pagina">
        <PanelEquipo
          filas={filas}
          avisos={avisos}
          hoy={hoy}
          tz={TZ}
          esAdmin
          base="/demo"
          ausenciasPendientes={estado.ausencias.filter((a) => a.estado === 'pendiente').length}
          alMarcarAviso={(id) => aplicar((e) => marcarAvisoDemo(e, id))}
        />
      </main>
    </>
  )
}
