import BotonImprimir from '@/components/BotonImprimir'
import Formulario from '@/components/Formulario'
import BloqueInforme, { type BloqueDatos } from '@/components/BloqueInforme'
import { corregirFichaje } from '@/app/actions'
import { ETIQUETA_TIPO, TIPOS_FICHAJE, TZ } from '@/lib/constants'
import { fechaLocal, finMes, formatHoras, hoyLocal, inicioMes, sumarDias } from '@/lib/fechas'
import { agruparJornadas, minutosTurno, turnosSinFichar } from '@/lib/jornada'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import { diasAusentes } from '@/lib/ausencias'
import type { Ausencia, Fichaje, Perfil, Turno } from '@/lib/types'

export const metadata = { title: 'Informes' }
export const dynamic = 'force-dynamic'

const FECHA = /^\d{4}-\d{2}-\d{2}$/

export default async function Informes({
  searchParams,
}: {
  searchParams: { desde?: string; hasta?: string; empleado?: string }
}) {
  await requerirGestor()
  const supabase = createClient()

  const hoy = hoyLocal()
  const desde = FECHA.test(searchParams.desde ?? '') ? searchParams.desde! : inicioMes(hoy)
  const hasta = FECHA.test(searchParams.hasta ?? '') ? searchParams.hasta! : finMes(hoy)
  const empleadoFiltro = searchParams.empleado && searchParams.empleado !== 'todos'
    ? searchParams.empleado
    : null

  const { data: perfilesData } = await supabase
    .from('perfiles')
    .select('*')
    .order('nombre')
  const perfiles = (perfilesData ?? []) as Perfil[]

  let consultaFichajes = supabase
    .from('fichajes')
    .select('*')
    .gte('ts', `${sumarDias(desde, -1)}T00:00:00`)
    .lte('ts', `${sumarDias(hasta, 2)}T00:00:00`)
    .order('ts', { ascending: true })
  let consultaTurnos = supabase.from('turnos').select('*').gte('fecha', desde).lte('fecha', hasta)
  let consultaAusencias = supabase
    .from('ausencias')
    .select('*')
    .eq('estado', 'aprobada')
    .lte('desde', hasta)
    .gte('hasta', desde)

  if (empleadoFiltro) {
    consultaFichajes = consultaFichajes.eq('empleado_id', empleadoFiltro)
    consultaTurnos = consultaTurnos.eq('empleado_id', empleadoFiltro)
    consultaAusencias = consultaAusencias.eq('empleado_id', empleadoFiltro)
  }

  const [resFichajes, resTurnos, resAusencias] = await Promise.all([
    consultaFichajes,
    consultaTurnos,
    consultaAusencias,
  ])
  const fichajes = (resFichajes.data ?? []) as Fichaje[]
  const turnos = (resTurnos.data ?? []) as Turno[]
  const ausencias = (resAusencias.data ?? []) as Ausencia[]

  const porEmpleado = new Map<string, Fichaje[]>()
  for (const f of fichajes) {
    const lista = porEmpleado.get(f.empleado_id) ?? []
    lista.push(f)
    porEmpleado.set(f.empleado_id, lista)
  }

  const nombrePor = Object.fromEntries(perfiles.map((p) => [p.id, p.nombre]))

  const bloques: BloqueDatos[] = perfiles
    .filter((p) => (empleadoFiltro ? p.id === empleadoFiltro : porEmpleado.has(p.id) || turnos.some((t) => t.empleado_id === p.id)))
    .map((p) => {
      const jornadas = agruparJornadas(porEmpleado.get(p.id) ?? [], new Date(), TZ).filter(
        (j) => j.fecha >= desde && j.fecha <= hasta,
      )
      const susTurnos = turnos.filter((t) => t.empleado_id === p.id && t.estado !== 'cancelado')
      const susFichajes = (porEmpleado.get(p.id) ?? []).filter((f) => {
        const dia = fechaLocal(f.ts, TZ)
        return dia >= desde && dia <= hasta
      })
      const susAusencias = ausencias.filter((a) => a.empleado_id === p.id)
      const ausentes = diasAusentes(susAusencias, desde, hasta)

      return {
        perfil: p,
        jornadas: [...jornadas].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        fichajes: susFichajes,
        ausencias: susAusencias,
        diasAusencia: ausentes.size,
        sinFichar: turnosSinFichar(susTurnos, jornadas, new Date(), TZ, ausentes),
        corregidos: susFichajes.filter((f) => f.origen === 'manual' || f.anulado_en !== null).length,
        trabajado: jornadas.reduce((s, j) => s + j.minutos_trabajados, 0),
        planificado: susTurnos.reduce((s, t) => s + minutosTurno(t), 0),
        aRevisar: jornadas.filter((j) => j.anomalias.length > 0).length,
      }
    })

  const totalTrabajado = bloques.reduce((s, b) => s + b.trabajado, 0)
  const totalPlanificado = bloques.reduce((s, b) => s + b.planificado, 0)
  const parametros = new URLSearchParams({ desde, hasta })
  if (empleadoFiltro) parametros.set('empleado', empleadoFiltro)

  return (
    <>
      <main className="pagina">
        <form className="tarjeta columna filtros no-imprimir" method="get">
          <div className="campos dos">
            <div>
              <label htmlFor="desde">Desde</label>
              <input id="desde" name="desde" type="date" defaultValue={desde} />
            </div>
            <div>
              <label htmlFor="hasta">Hasta</label>
              <input id="hasta" name="hasta" type="date" defaultValue={hasta} />
            </div>
          </div>
          <div>
            <label htmlFor="empleado">Empleado</label>
            <select id="empleado" name="empleado" defaultValue={empleadoFiltro ?? 'todos'}>
              <option value="todos">Todo el equipo</option>
              {perfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn primario">
            Ver informe
          </button>
        </form>

        <div className="fila descargas no-imprimir" style={{ gap: 10, flexWrap: 'wrap' }}>
          <a className="btn crece" href={`/api/informe?${parametros.toString()}`} download>
            CSV de jornadas
          </a>
          <a
            className="btn crece"
            href={`/api/informe?${parametros.toString()}&detalle=movimientos`}
            download
          >
            CSV con historial
          </a>
          <BotonImprimir />
        </div>
        <p className="mini suave no-imprimir">
          El CSV de jornadas es el resumen por día. El de historial trae cada movimiento con su
          origen, si se anuló, quién lo tocó y con qué motivo.
        </p>

        <div className="metricas">
          <div>
            <p className="v mono">{formatHoras(totalTrabajado)}</p>
            <p className="k">Trabajado</p>
          </div>
          <div>
            <p className="v mono">{formatHoras(totalPlanificado)}</p>
            <p className="k">Planificado</p>
          </div>
          <div>
            <p className="v mono">{bloques.length}</p>
            <p className="k">Personas</p>
          </div>
        </div>

        <p className="mini suave">
          Periodo {desde} a {hasta}. Horas en formato h:mm.
        </p>

        {bloques.length === 0 && <p className="vacio">Sin datos en este periodo</p>}

        {bloques.map((b) => (
          <BloqueInforme key={b.perfil.id} b={b} nombrePor={nombrePor} tz={TZ} />
        ))}

        <details className="tarjeta no-imprimir">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Corregir un fichaje</summary>
          <p className="pequeno suave" style={{ margin: '10px 0' }}>
            La corrección no borra nada: añade un fichaje marcado como manual, con tu nombre y el
            motivo, para que el registro siga siendo trazable.
          </p>
          <Formulario accion={corregirFichaje} boton="Añadir corrección" limpiarAlEnviar>
            <div>
              <label htmlFor="c-empleado">Empleado</label>
              <select id="c-empleado" name="empleado_id" required defaultValue="">
                <option value="" disabled>
                  Elige…
                </option>
                {perfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="c-tipo">Tipo</label>
              <select id="c-tipo" name="tipo" required defaultValue="entrada">
                {TIPOS_FICHAJE.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETA_TIPO[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="campos dos">
              <div>
                <label htmlFor="c-fecha">Fecha</label>
                <input id="c-fecha" name="fecha" type="date" required defaultValue={hoy} />
              </div>
              <div>
                <label htmlFor="c-hora">Hora</label>
                <input id="c-hora" name="hora" type="time" required />
              </div>
            </div>
            <div>
              <label htmlFor="c-nota">Motivo</label>
              <input
                id="c-nota"
                name="nota"
                required
                minLength={3}
                placeholder="Se quedó sin batería al salir"
              />
            </div>
          </Formulario>
        </details>
      </main>
    </>
  )
}
