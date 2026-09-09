import HistorialFichajes from '@/components/HistorialFichajes'
import { ETIQUETA_ANOMALIA } from '@/lib/constants'
import { formatFechaLarga, formatHoras, formatMinutos, horaLocal } from '@/lib/fechas'
import { minutosTurno, type Jornada } from '@/lib/jornada'
import type { Fichaje, Perfil, Turno } from '@/lib/types'

export type BloqueDatos = {
  perfil: Perfil
  jornadas: Jornada[]
  fichajes: Fichaje[]
  sinFichar: Turno[]
  corregidos: number
  trabajado: number
  planificado: number
  aRevisar: number
}

/**
 * Informe de una persona: tabla de jornadas, turnos que pasaron sin fichar y
 * el historial completo de movimientos. Lo comparten la página real y la demo.
 */
export default function BloqueInforme({
  b,
  nombrePor,
  tz,
  editable = true,
  demo,
}: {
  b: BloqueDatos
  nombrePor: Record<string, string>
  tz: string
  editable?: boolean
  demo?: {
    corregir: (form: FormData) => { ok?: string; error?: string }
    anular: (form: FormData) => { ok?: string; error?: string }
  }
}) {
  return (
    <div className="tarjeta">
      <header>
        <div>
          <h2>{b.perfil.nombre}</h2>
          <p className="mini suave">
            {b.perfil.horas_semana} h/semana · {b.jornadas.length} jornadas
            {b.aRevisar > 0 && ` · ${b.aRevisar} a revisar`}
            {b.sinFichar.length > 0 && ` · ${b.sinFichar.length} sin fichar`}
            {b.corregidos > 0 && ` · ${b.corregidos} tocados a mano`}
          </p>
        </div>
        <span className="mono" style={{ fontWeight: 700 }}>
          {formatHoras(b.trabajado)}
        </span>
      </header>

      {b.jornadas.length === 0 ? (
        <p className="vacio">Sin fichajes</p>
      ) : (
        <div className="tabla-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Entrada</th>
                <th>Salida</th>
                <th className="num">Pausa</th>
                <th className="num">Total</th>
                <th>Ubicación</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {b.jornadas.map((j) => {
                const fuera = j.anomalias.includes('fuera_de_radio')
                const sinUbi = j.anomalias.includes('sin_ubicacion')
                return (
                  <tr key={`${j.fecha}-${j.entrada}`}>
                    <td className="mono">{j.fecha}</td>
                    <td className="mono">{horaLocal(j.entrada, tz)}</td>
                    <td className="mono">{j.abierta ? 'abierta' : horaLocal(j.salida, tz)}</td>
                    <td className="num mono">{formatHoras(j.minutos_pausa)}</td>
                    <td className="num mono">{formatHoras(j.minutos_trabajados)}</td>
                    <td>{fuera ? 'Fuera del centro' : sinUbi ? 'Sin ubicación' : 'Verificada'}</td>
                    <td>
                      {j.anomalias
                        .filter((a) => a !== 'fuera_de_radio' && a !== 'sin_ubicacion')
                        .map((a) => ETIQUETA_ANOMALIA[a])
                        .join(', ')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Total</th>
                <th className="num mono">{formatHoras(b.trabajado)}</th>
                <th colSpan={2}>
                  {b.planificado > 0 &&
                    `Planificado ${formatHoras(b.planificado)} · desviación ${formatMinutos(
                      b.trabajado - b.planificado,
                    )}`}
                </th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {b.sinFichar.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3 style={{ marginBottom: 8 }}>Turnos que pasaron sin fichar</h3>
          <div className="lista">
            {b.sinFichar.map((t) => (
              <div key={t.id} className="item">
                <span className="crece" style={{ textTransform: 'capitalize' }}>
                  {formatFechaLarga(t.fecha, tz)}
                </span>
                <span className="mono suave pequeno">
                  {t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}
                </span>
                <span className="pill error mono">{formatHoras(minutosTurno(t))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <details style={{ marginTop: 14 }} className="no-imprimir">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Historial de movimientos y correcciones ({b.fichajes.length})
        </summary>
        <p className="pequeno suave" style={{ margin: '10px 0 14px' }}>
          Todos los fichajes tal cual entraron, incluidos los anulados. Desde aquí puedes corregir
          la hora de uno o anularlo: en ambos casos queda registrado quién lo hizo y por qué.
        </p>
        <HistorialFichajes
          fichajes={b.fichajes}
          nombrePor={nombrePor}
          tz={tz}
          editable={editable}
          demo={demo}
        />
      </details>
    </div>
  )
}
