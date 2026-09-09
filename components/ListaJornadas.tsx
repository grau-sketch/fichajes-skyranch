import { ETIQUETA_ANOMALIA, ETIQUETA_TIPO } from '@/lib/constants'
import { formatFechaLarga, formatMinutos, horaLocal } from '@/lib/fechas'
import type { Jornada } from '@/lib/jornada'

export default function ListaJornadas({
  jornadas,
  tz,
  detalle = true,
}: {
  jornadas: Jornada[]
  tz: string
  detalle?: boolean
}) {
  if (jornadas.length === 0) {
    return <p className="vacio">No hay jornadas registradas en este periodo</p>
  }

  return (
    <div className="lista">
      {jornadas.map((j) => (
        <div key={`${j.fecha}-${j.entrada}`} className="columna" style={{ gap: 6, padding: '12px 0' }}>
          <div className="fila entre">
            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
              {formatFechaLarga(j.fecha, tz)}
            </span>
            <span className="mono" style={{ fontWeight: 650 }}>
              {j.abierta ? '—' : formatMinutos(j.minutos_trabajados)}
            </span>
          </div>

          <div className="fila pequeno suave" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="mono">
              {horaLocal(j.entrada, tz)} → {j.abierta ? 'en curso' : horaLocal(j.salida, tz)}
            </span>
            {j.minutos_pausa > 0 && <span>· {formatMinutos(j.minutos_pausa)} de pausa</span>}
            {j.abierta && <span className="pill marca">Abierta</span>}
            {j.anomalias.map((a) => (
              <span
                key={a}
                className={`pill ${a === 'corregido' ? '' : a === 'fuera_de_radio' ? 'error' : 'aviso'}`}
              >
                {ETIQUETA_ANOMALIA[a]}
              </span>
            ))}
          </div>

          {detalle && (
            <div className="fila mini suave" style={{ gap: 10, flexWrap: 'wrap' }}>
              {j.fichajes.map((f) => (
                <span key={f.id} className="mono">
                  {horaLocal(f.ts, tz)} {ETIQUETA_TIPO[f.tipo].toLowerCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
