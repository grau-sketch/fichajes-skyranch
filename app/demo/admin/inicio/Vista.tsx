'use client'

import Link from 'next/link'
import { useDemo } from '@/components/DemoProvider'
import { TZ, estadoDesdeUltimo, type TipoFichaje } from '@/lib/constants'
import { HOY } from '@/lib/demo'
import { formatFechaLarga, hoyLocal } from '@/lib/fechas'

const horaCorta = (ts: string, tz: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
    new Date(ts),
  )

export default function Vista() {
  const { estado } = useDemo()
  const hoy = hoyLocal(TZ) === HOY ? HOY : hoyLocal(TZ)
  const admin = estado.perfiles.find((p) => p.id === estado.admin)!

  const conEstado = estado.perfiles
    .filter((p) => p.id !== admin.id && p.activo)
    .map((p) => {
      const vigentes = estado.fichajes.filter((f) => f.empleado_id === p.id && f.anulado_en === null)
      const ultimo = [...vigentes].sort((a, b) => b.ts.localeCompare(a.ts))[0]
      return {
        id: p.id,
        nombre: p.nombre,
        estado: estadoDesdeUltimo((ultimo?.tipo as TipoFichaje) ?? null),
        ultimoTs: ultimo?.ts ?? null,
      }
    })

  const trabajando = conEstado.filter((p) => p.estado === 'dentro')
  const enPausa = conEstado.filter((p) => p.estado === 'pausa')
  const avisosSinLeer = estado.avisos.filter(
    (a) => a.destinatario_id === admin.id && a.leido_en === null,
  ).length
  const ausenciasPendientes = estado.ausencias.filter((a) => a.estado === 'pendiente').length

  return (
    <main className="pagina">
      <div className="tarjeta">
        <header>
          <h2 style={{ textTransform: 'capitalize' }}>{formatFechaLarga(hoy, TZ)}</h2>
        </header>

        <div className="metricas">
          <div>
            <p className="v mono">{trabajando.length}</p>
            <p className="k">Trabajando</p>
          </div>
          <div>
            <p className="v mono">{enPausa.length}</p>
            <p className="k">En pausa</p>
          </div>
          <div>
            <p className="v mono">{conEstado.length - trabajando.length - enPausa.length}</p>
            <p className="k">Fuera</p>
          </div>
        </div>

        {trabajando.length + enPausa.length > 0 && (
          <div className="lista" style={{ marginTop: 8 }}>
            {[...trabajando, ...enPausa].map((p) => (
              <div key={p.id} className="fila entre" style={{ padding: '8px 0' }}>
                <span>{p.nombre}</span>
                <span className={`pill ${p.estado === 'dentro' ? 'ok' : 'aviso'}`}>
                  {p.estado === 'dentro' ? 'Trabajando' : 'En pausa'}
                  {p.ultimoTs && ` · ${horaCorta(p.ultimoTs, TZ)}`}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link href="/demo/admin" className="mini" style={{ display: 'inline-block', marginTop: 12 }}>
          Ver equipo completo →
        </Link>
      </div>

      <div className="tarjeta">
        <header>
          <h2>Hoy en el calendario</h2>
        </header>
        <p className="vacio">
          Este apartado muestra tu Google Calendar real y solo existe conectado a un servidor de
          verdad; la demo no lo simula.
        </p>
      </div>

      {(avisosSinLeer > 0 || ausenciasPendientes > 0) && (
        <div className="tarjeta">
          <header>
            <h2>Pendiente de ti</h2>
          </header>
          <div className="columna" style={{ gap: 8 }}>
            {avisosSinLeer > 0 && (
              <p>
                <strong>{avisosSinLeer}</strong>{' '}
                {avisosSinLeer === 1 ? 'aviso sin leer' : 'avisos sin leer'}
              </p>
            )}
            {ausenciasPendientes > 0 && (
              <p>
                <Link href="/demo/admin/ausencias">
                  <strong>{ausenciasPendientes}</strong>{' '}
                  {ausenciasPendientes === 1
                    ? 'solicitud de ausencia esperando'
                    : 'solicitudes de ausencia esperando'}
                </Link>
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
