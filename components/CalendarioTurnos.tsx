'use client'

import { useMemo, useState } from 'react'
import { DIAS_SEMANA, DIAS_SEMANA_CORTO, TZ } from '@/lib/constants'
import {
  diasEntre,
  finMes,
  finSemana,
  formatMinutos,
  hoyLocal,
  inicioMes,
  inicioSemana,
  sumarDias,
} from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'
import type { Turno } from '@/lib/types'

type Vista = 'semana' | 'mes'

const nombreCorto = (fecha: string) =>
  DIAS_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()].slice(0, 3)

const mesLargo = (fecha: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, month: 'long', year: 'numeric' }).format(
    new Date(`${fecha}T12:00:00Z`),
  )

const diaYMes = (fecha: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, day: 'numeric', month: 'short' }).format(
    new Date(`${fecha}T12:00:00Z`),
  )

/**
 * Calendario de turnos: semana por defecto, mes si se despliega. Solo muestra
 * turnos planificados — nada de fichajes ni de horas trabajadas.
 */
export default function CalendarioTurnos({
  turnos,
  tz = TZ,
  vistaInicial = 'semana',
}: {
  turnos: Turno[]
  tz?: string
  vistaInicial?: Vista
}) {
  const hoy = hoyLocal(tz)
  const [vista, setVista] = useState<Vista>(vistaInicial)
  const [ancla, setAncla] = useState(hoy)
  const [diaSel, setDiaSel] = useState<string | null>(null)

  const porDia = useMemo(() => {
    const mapa = new Map<string, Turno[]>()
    for (const t of turnos) {
      if (t.estado === 'cancelado') continue
      mapa.set(t.fecha, [...(mapa.get(t.fecha) ?? []), t])
    }
    for (const [, lista] of mapa) lista.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    return mapa
  }, [turnos])

  const desde = vista === 'semana' ? inicioSemana(ancla) : inicioMes(ancla)
  const hasta = vista === 'semana' ? finSemana(ancla) : finMes(ancla)

  const dias = useMemo(() => {
    const total = diasEntre(desde, hasta)
    return Array.from({ length: total }, (_, i) => sumarDias(desde, i))
  }, [desde, hasta])

  const minutosPeriodo = dias.reduce(
    (s, d) => s + (porDia.get(d) ?? []).reduce((x, t) => x + minutosTurno(t), 0),
    0,
  )

  const mover = (pasos: number) => {
    setDiaSel(null)
    setAncla(vista === 'semana' ? sumarDias(ancla, 7 * pasos) : sumarDias(inicioMes(ancla), pasos > 0 ? 32 : -1))
  }

  const titulo =
    vista === 'semana'
      ? `${diaYMes(desde, tz)} – ${diaYMes(hasta, tz)}`
      : mesLargo(ancla, tz)

  // La rejilla mensual empieza en lunes: se rellenan los huecos del principio.
  const huecosIniciales = useMemo(() => {
    if (vista !== 'mes') return []
    const primerDow = new Date(`${desde}T12:00:00Z`).getUTCDay() // 0 = domingo
    const desplazamiento = primerDow === 0 ? 6 : primerDow - 1
    return Array.from({ length: desplazamiento }, (_, i) => sumarDias(desde, i - desplazamiento))
  }, [vista, desde])

  const enPeriodo = (fecha: string) => fecha >= desde && fecha <= hasta
  const turnosSel = diaSel ? (porDia.get(diaSel) ?? []) : []

  return (
    <div className="columna" style={{ gap: 14 }}>
      <div className="segmentado" role="group" aria-label="Vista del calendario">
        <button type="button" aria-pressed={vista === 'semana'} onClick={() => setVista('semana')}>
          Semana
        </button>
        <button type="button" aria-pressed={vista === 'mes'} onClick={() => setVista('mes')}>
          Mes
        </button>
      </div>

      <div className="cal-nav">
        <button
          type="button"
          className="btn cal-flecha"
          onClick={() => mover(-1)}
          aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}
        >
          ←
        </button>
        <span className="titulo">{titulo}</span>
        <button
          type="button"
          className="btn cal-flecha"
          onClick={() => mover(1)}
          aria-label={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}
        >
          →
        </button>
      </div>

      <div className="fila entre">
        <span className="pill marca mono">{formatMinutos(minutosPeriodo)} planificadas</span>
        {!enPeriodo(hoy) && (
          <button
            type="button"
            className="btn mini"
            onClick={() => {
              setAncla(hoy)
              setDiaSel(null)
            }}
          >
            Ir a hoy
          </button>
        )}
      </div>

      {vista === 'semana' ? (
        <div>
          {dias.map((d) => {
            const delDia = porDia.get(d) ?? []
            return (
              <div key={d} className={`cal-dia ${d === hoy ? 'hoy' : ''}`}>
                <div className="fecha">
                  <p className="dia">{nombreCorto(d)}</p>
                  <p className="num">{Number(d.slice(8, 10))}</p>
                </div>
                {delDia.length === 0 ? (
                  <p className="libre">Libre</p>
                ) : (
                  <div className="fila crece" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {delDia.map((t) => (
                      <span key={t.id} className="turno-chip">
                        <span className="horas">
                          {t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}
                        </span>
                        <span className="detalle">
                          {formatMinutos(minutosTurno(t))}
                          {t.pausa_min > 0 && ` · ${t.pausa_min} min de pausa`}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div className="cal-mes">
            {DIAS_SEMANA_CORTO.slice(1)
              .concat(DIAS_SEMANA_CORTO[0])
              .map((d, i) => (
                <div key={`${d}-${i}`} className="cabeza">
                  {d}
                </div>
              ))}

            {huecosIniciales.map((d) => (
              <button key={`hueco-${d}`} type="button" className="cal-celda fuera" disabled>
                <span className="num">{Number(d.slice(8, 10))}</span>
              </button>
            ))}

            {dias.map((d) => {
              const delDia = porDia.get(d) ?? []
              return (
                <button
                  key={d}
                  type="button"
                  className={`cal-celda ${delDia.length > 0 ? 'con-turno' : ''} ${
                    d === hoy ? 'hoy' : ''
                  }`}
                  aria-pressed={diaSel === d}
                  onClick={() => setDiaSel(diaSel === d ? null : d)}
                >
                  <span className="num">{Number(d.slice(8, 10))}</span>
                  {delDia.slice(0, 2).map((t) => (
                    <span key={t.id} className="rango">
                      {t.hora_inicio.slice(0, 5)}
                    </span>
                  ))}
                  {delDia.length > 2 && <span className="rango">+{delDia.length - 2}</span>}
                </button>
              )
            })}
          </div>

          {diaSel && (
            <div className="tarjeta plana columna" style={{ gap: 8 }}>
              <h3 style={{ textTransform: 'capitalize' }}>
                {DIAS_SEMANA[new Date(`${diaSel}T12:00:00Z`).getUTCDay()]} {diaYMes(diaSel, tz)}
              </h3>
              {turnosSel.length === 0 ? (
                <p className="suave pequeno">Día libre</p>
              ) : (
                turnosSel.map((t) => (
                  <div key={t.id} className="fila entre">
                    <span className="mono">
                      {t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}
                      {t.pausa_min > 0 && (
                        <span className="suave"> · {t.pausa_min} min de pausa</span>
                      )}
                    </span>
                    <span className="pill marca mono">{formatMinutos(minutosTurno(t))}</span>
                  </div>
                ))
              )}
            </div>
          )}

          <p className="mini suave centrado">Toca un día para ver el detalle</p>
        </>
      )}
    </div>
  )
}
