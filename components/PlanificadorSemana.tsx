'use client'

import Link from 'next/link'
import { useState } from 'react'
import Formulario, { type Respuesta } from '@/components/Formulario'
import { copiarSemana, guardarSemana } from '@/app/actions'
import { ABREVIA_AUSENCIA, ausenciaDelDia } from '@/lib/ausencias'
import { DIAS_SEMANA, ETIQUETA_AUSENCIA } from '@/lib/constants'
import { formatMinutos, numeroSemanaISO, rangoSemanaTxt, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'
import type { Ausencia, Perfil, Turno } from '@/lib/types'

type Modo = 'trabaja' | 'libre' | 'nada'
type Tramo = { inicio: string; fin: string; pausa: string }
type Dia = { modo: Modo; uno: Tramo; dos: Tramo }

const VACIO: Tramo = { inicio: '', fin: '', pausa: '0' }
const POR_DEFECTO: Dia = { modo: 'nada', uno: { ...VACIO }, dos: { ...VACIO } }

/** Nombre del día i (0 = lunes), que en DIAS_SEMANA el 0 es domingo. */
const nombreDia = (i: number) => DIAS_SEMANA[(i + 1) % 7]

const minutosTramo = (t: Tramo) =>
  t.inicio && t.fin
    ? minutosTurno({ hora_inicio: t.inicio, hora_fin: t.fin, pausa_min: Number(t.pausa) || 0 })
    : 0

/** Reconstruye el estado del formulario a partir de los turnos guardados. */
function desdeTurnos(semana: string, turnos: Turno[]): Dia[] {
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(semana, i)
    const delDia = turnos.filter((t) => t.fecha === fecha && t.estado !== 'cancelado')

    if (delDia.some((t) => t.estado === 'libre')) {
      return { modo: 'libre' as Modo, uno: { ...VACIO }, dos: { ...VACIO } }
    }
    const trabajo = delDia
      .filter((t) => t.estado !== 'libre')
      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    if (trabajo.length === 0) return { ...POR_DEFECTO, uno: { ...VACIO }, dos: { ...VACIO } }

    const tramo = (t?: Turno): Tramo =>
      t
        ? { inicio: t.hora_inicio.slice(0, 5), fin: t.hora_fin.slice(0, 5), pausa: String(t.pausa_min) }
        : { ...VACIO }
    return { modo: 'trabaja' as Modo, uno: tramo(trabajo[0]), dos: tramo(trabajo[1]) }
  })
}

/**
 * Planifica una semana entera de un tirón: cada día son dos turnos (el horario
 * partido es lo normal en la finca), un día libre marcado a mano, o nada.
 *
 * La usan la consola real y la demo, así que la presentación vive aquí.
 */
export default function PlanificadorSemana({
  empleado,
  semana,
  turnos,
  ausencias = [],
  hoy,
  base = '',
  demo,
}: {
  empleado: Perfil
  /** Lunes de la semana que se está planificando. */
  semana: string
  turnos: Turno[]
  ausencias?: Ausencia[]
  hoy: string
  base?: string
  demo?: {
    guardarSemana: (form: FormData) => Respuesta
    copiarSemana: (form: FormData) => Respuesta
  }
}) {
  const [dias, setDias] = useState<Dia[]>(() => desdeTurnos(semana, turnos))

  const cambiar = (i: number, cambio: Partial<Dia>) =>
    setDias((previo) => previo.map((d, j) => (j === i ? { ...d, ...cambio } : d)))

  const cambiarTramo = (i: number, cual: 'uno' | 'dos', cambio: Partial<Tramo>) =>
    setDias((previo) =>
      previo.map((d, j) => (j === i ? { ...d, [cual]: { ...d[cual], ...cambio } } : d)),
    )

  const minutosDia = (d: Dia) =>
    d.modo === 'trabaja' ? minutosTramo(d.uno) + minutosTramo(d.dos) : 0
  const totalSemana = dias.reduce((s, d) => s + minutosDia(d), 0)
  const objetivo = empleado.horas_semana * 60
  const diferencia = totalSemana - objetivo

  const anterior = sumarDias(semana, -7)
  const siguiente = sumarDias(semana, 7)
  const ruta = (s: string) => `${base}/admin/turnos?empleado=${empleado.id}&semana=${s}`
  const esPasada = sumarDias(semana, 6) < hoy

  return (
    <>
      <div className="tarjeta">
        <div className="semana-barra">
          <Link className="btn mini" href={ruta(anterior)} aria-label="Semana anterior">
            ‹
          </Link>
          <div className="crece" style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 600 }}>Semana {numeroSemanaISO(semana)}</p>
            <p className="mini suave">{rangoSemanaTxt(semana)}</p>
          </div>
          <Link className="btn mini" href={ruta(siguiente)} aria-label="Semana siguiente">
            ›
          </Link>
        </div>

        <div className="fila" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Link className="btn mini" href={ruta(sumarDias(hoy, 0))}>
            Esta semana
          </Link>
          <Formulario
            accion={copiarSemana}
            demo={demo?.copiarSemana}
            boton="Copiar la semana anterior"
            botonClase="btn mini"
            confirmar={`Se reemplaza lo que haya en la semana ${numeroSemanaISO(semana)}. ¿Seguimos?`}
          >
            <input type="hidden" name="empleado_id" value={empleado.id} />
            <input type="hidden" name="origen" value={anterior} />
            <input type="hidden" name="destino" value={semana} />
          </Formulario>
        </div>

        {esPasada && (
          <p className="nota" style={{ marginTop: 12 }}>
            Esta semana ya ha pasado. Si cambias el horario, cambian también los desvíos que salen
            en las fichas y en los informes.
          </p>
        )}
      </div>

      <Formulario
        accion={guardarSemana}
        demo={demo?.guardarSemana}
        boton={`Guardar la semana ${numeroSemanaISO(semana)}`}
      >
        <input type="hidden" name="empleado_id" value={empleado.id} />
        <input type="hidden" name="desde" value={semana} />

        <div className="tarjeta" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="planificador">
            {dias.map((d, i) => {
              const fecha = sumarDias(semana, i)
              const ausencia = ausenciaDelDia(ausencias, fecha)
              const minutos = minutosDia(d)

              return (
                <div
                  key={fecha}
                  className={`dia es-${d.modo === 'trabaja' ? 'trabaja' : d.modo}${
                    fecha === hoy ? ' es-hoy' : ''
                  }`}
                >
                  <div className="dia-cabecera">
                    <div className="crece">
                      <p className="dia-nombre">{nombreDia(i)}</p>
                      <p className="mini suave mono">{fecha.slice(8, 10)}/{fecha.slice(5, 7)}</p>
                    </div>

                    {ausencia && (
                      <span className="pill" title={ETIQUETA_AUSENCIA[ausencia.tipo]}>
                        {ABREVIA_AUSENCIA[ausencia.tipo]}
                      </span>
                    )}

                    <div className="segmentado mini" role="group">
                      {(['trabaja', 'libre', 'nada'] as Modo[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={d.modo === m}
                          onClick={() => cambiar(i, { modo: m })}
                        >
                          {m === 'trabaja' ? 'Trabaja' : m === 'libre' ? 'Libre' : '—'}
                        </button>
                      ))}
                    </div>

                    <span className="mono dia-total">
                      {d.modo === 'trabaja' ? formatMinutos(minutos) : d.modo === 'libre' ? 'Libre' : ''}
                    </span>
                  </div>

                  <input type="hidden" name={`d${i}`} value={d.modo} />

                  {d.modo === 'trabaja' && (
                    <div className="dia-tramos">
                      {(['uno', 'dos'] as const).map((cual, n) => (
                        <div key={cual} className="tramo">
                          <span className="mini suave tramo-etiqueta">
                            {n === 0 ? 'Mañana' : 'Tarde'}
                          </span>
                          <input
                            type="time"
                            name={`d${i}_${n + 1}i`}
                            value={d[cual].inicio}
                            onChange={(e) => cambiarTramo(i, cual, { inicio: e.target.value })}
                            aria-label={`${nombreDia(i)}, entrada del turno ${n + 1}`}
                          />
                          <span className="suave">–</span>
                          <input
                            type="time"
                            name={`d${i}_${n + 1}f`}
                            value={d[cual].fin}
                            onChange={(e) => cambiarTramo(i, cual, { fin: e.target.value })}
                            aria-label={`${nombreDia(i)}, salida del turno ${n + 1}`}
                          />
                          <label className="tramo-pausa mini suave">
                            pausa
                            <input
                              type="number"
                              name={`d${i}_${n + 1}p`}
                              min={0}
                              max={480}
                              step={5}
                              value={d[cual].pausa}
                              onChange={(e) => cambiarTramo(i, cual, { pausa: e.target.value })}
                              aria-label={`${nombreDia(i)}, pausa del turno ${n + 1}`}
                            />
                            min
                          </label>
                          {(d[cual].inicio || d[cual].fin) && (
                            <button
                              type="button"
                              className="btn mini"
                              onClick={() => cambiarTramo(i, cual, { ...VACIO })}
                            >
                              Vaciar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="planificador-pie">
            <span className="crece">
              Contrato {empleado.horas_semana} h · planificado{' '}
              <strong className="mono">{formatMinutos(totalSemana)}</strong>
            </span>
            {totalSemana > 0 && Math.abs(diferencia) > 30 && (
              <span className={`pill ${diferencia > 0 ? 'aviso' : ''}`}>
                {diferencia > 0 ? '+' : '−'}
                {formatMinutos(Math.abs(diferencia))}
              </span>
            )}
          </div>
        </div>
      </Formulario>
    </>
  )
}
