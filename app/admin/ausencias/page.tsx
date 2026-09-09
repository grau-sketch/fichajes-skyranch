import ListaAusencias from '@/components/ListaAusencias'
import PedirAusencia from '@/components/PedirAusencia'
import { DIAS_VACACIONES_MINIMO } from '@/lib/constants'
import { resumenVacaciones } from '@/lib/ausencias'
import { hoyLocal } from '@/lib/fechas'
import { requerirGestor } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Ausencia, Perfil } from '@/lib/types'

export const metadata = { title: 'Ausencias' }
export const dynamic = 'force-dynamic'

export default async function Ausencias({
  searchParams,
}: {
  searchParams: { empleado?: string }
}) {
  await requerirGestor()
  const supabase = createClient()
  const anio = Number(hoyLocal().slice(0, 4))

  const [resPerfiles, resAusencias] = await Promise.all([
    supabase.from('perfiles').select('*').eq('activo', true).order('nombre'),
    supabase
      .from('ausencias')
      .select('*')
      .gte('hasta', `${anio}-01-01`)
      .order('desde', { ascending: false }),
  ])

  const perfiles = (resPerfiles.data ?? []) as Perfil[]
  const ausencias = (resAusencias.data ?? []) as Ausencia[]
  const nombrePor = Object.fromEntries(perfiles.map((p) => [p.id, p.nombre]))

  const pendientes = ausencias.filter((a) => a.estado === 'pendiente')
  const elegido = perfiles.find((p) => p.id === searchParams.empleado) ?? perfiles[0] ?? null

  return (
    <>
      <main className="pagina">
        <div className="tarjeta">
          <header>
            <h2>Pendientes de decidir</h2>
            {pendientes.length > 0 && <span className="pill aviso">{pendientes.length}</span>}
          </header>
          {pendientes.length === 0 ? (
            <p className="vacio">No hay solicitudes esperando</p>
          ) : (
            <ListaAusencias ausencias={pendientes} nombrePor={nombrePor} puedeDecidir />
          )}
        </div>

        <div className="tarjeta">
          <header>
            <h2>Vacaciones del equipo</h2>
            <span className="mini suave">días naturales</span>
          </header>
          <div className="tabla-scroll">
            <table>
              <thead>
                <tr>
                  <th>Persona</th>
                  <th className="num">Del año</th>
                  <th className="num">Disfrutados</th>
                  <th className="num">Por aprobar</th>
                  <th className="num">Restantes</th>
                </tr>
              </thead>
              <tbody>
                {perfiles.map((p) => {
                  const v = resumenVacaciones(
                    ausencias.filter((a) => a.empleado_id === p.id),
                    p.dias_vacaciones,
                    anio,
                  )
                  return (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td className="num mono">{v.total}</td>
                      <td className="num mono">{v.usados}</td>
                      <td className="num mono">{v.pendientes}</td>
                      <td className="num mono">
                        <strong>{v.restantes}</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mini suave" style={{ marginTop: 12 }}>
            El mínimo legal son {DIAS_VACACIONES_MINIMO} días naturales al año. Se ajusta por
            persona en Personal y centros.
          </p>
        </div>

        {elegido && (
          <div className="tarjeta">
            <header>
              <h2>Registrar una ausencia</h2>
            </header>
            <p className="pequeno suave" style={{ marginBottom: 14 }}>
              Lo que registres aquí entra ya aprobado y descuenta horas del objetivo del periodo.
              Las faltas no justificadas también se anotan aquí.
            </p>
            <form method="get" style={{ marginBottom: 14 }}>
              <label htmlFor="empleado">Persona</label>
              <select id="empleado" name="empleado" defaultValue={elegido.id}>
                {perfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn" style={{ marginTop: 10, width: '100%' }}>
                Cambiar de persona
              </button>
            </form>
            <PedirAusencia empleadoId={elegido.id} comoGestor />
          </div>
        )}

        <div className="tarjeta">
          <header>
            <h2>Historial del año</h2>
            <span className="mini suave">{ausencias.length}</span>
          </header>
          <ListaAusencias ausencias={ausencias} nombrePor={nombrePor} puedeDecidir />
        </div>
      </main>
    </>
  )
}
