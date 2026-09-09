import { formatHoras, formatMinutos } from '@/lib/fechas'
import type { Proyeccion } from '@/lib/proyeccion'

/**
 * Muestra adónde va a llegar el periodo: lo ya fichado (sólido) más lo que
 * queda planificado (translúcido), contra el objetivo del contrato.
 */
export default function BarraProyeccion({
  titulo,
  proyeccion,
}: {
  titulo: string
  proyeccion: Proyeccion
}) {
  const { objetivo_min, trabajado_min, pendiente_min, desviacion_min, proyectado_min } = proyeccion
  const base = Math.max(objetivo_min, proyectado_min, 1)
  const pHecho = Math.min(100, (trabajado_min / base) * 100)
  const pPrevisto = Math.min(100 - pHecho, (pendiente_min / base) * 100)

  const cumple = desviacion_min >= 0
  const tolerancia = 30 // ±30 min se considera cuadrado

  return (
    <div className="tarjeta columna" style={{ gap: 12 }}>
      <div className="fila entre">
        <h2>{titulo}</h2>
        <span
          className={`pill ${
            Math.abs(desviacion_min) <= tolerancia ? 'ok' : cumple ? 'marca' : 'aviso'
          }`}
        >
          {Math.abs(desviacion_min) <= tolerancia
            ? 'Cuadra'
            : cumple
              ? `+${formatMinutos(desviacion_min)}`
              : formatMinutos(desviacion_min)}
        </span>
      </div>

      <div className="barra" role="img" aria-label={`${formatMinutos(trabajado_min)} de ${formatMinutos(objetivo_min)}`}>
        <span className="hecho" style={{ width: `${pHecho}%` }} />
        <span className="previsto" style={{ width: `${pPrevisto}%` }} />
      </div>

      <div className="metricas">
        <div>
          <p className="v mono">{formatHoras(trabajado_min)}</p>
          <p className="k">Fichado</p>
        </div>
        <div>
          <p className="v mono">{formatHoras(pendiente_min)}</p>
          <p className="k">Por hacer</p>
        </div>
        <div>
          <p className="v mono">{formatHoras(objetivo_min)}</p>
          <p className="k">Objetivo</p>
        </div>
      </div>

      <p className="pequeno suave">
        {proyeccion.no_llega ? (
          <>
            Con los turnos planificados llegarás a {formatMinutos(proyectado_min)}:{' '}
            <strong>te faltan {formatMinutos(-desviacion_min)}</strong> para el objetivo del periodo.
            {proyeccion.turnos_pendientes > 0 &&
              ` Tienes ${proyeccion.turnos_pendientes} turno(s) por fichar.`}
          </>
        ) : (
          <>
            Si cumples los {proyeccion.turnos_pendientes} turno(s) que te quedan llegarás a{' '}
            {formatMinutos(proyectado_min)}.
          </>
        )}
        {proyeccion.turnos_sin_fichar > 0 && (
          <>
            {' '}
            <strong>{proyeccion.turnos_sin_fichar} turno(s) pasaron sin fichar.</strong>
          </>
        )}
      </p>
    </div>
  )
}
