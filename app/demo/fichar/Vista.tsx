'use client'

import Link from 'next/link'
import { useState } from 'react'
import Marca from '@/components/Marca'
import AvisoBanner from '@/components/AvisoBanner'
import ReiniciarDemo from '@/components/ReiniciarDemo'
import { useDemo } from '@/components/DemoProvider'
import Reloj from '@/components/Reloj'
import { TZ, type TipoFichaje } from '@/lib/constants'
import { HOY } from '@/lib/demo'
import { ficharDemo, marcarAvisoDemo } from '@/lib/demoEstado'
import { formatMinutos, sumarDias } from '@/lib/fechas'
import { distanciaM, type Posicion } from '@/lib/geo'
import { minutosTurno } from '@/lib/jornada'

/**
 * En la demo la ubicación se elige a mano: así se pueden probar el fichaje
 * dentro del centro, el de fuera (que avisa al responsable) y el que no tiene
 * GPS, sin depender de dónde esté el navegador.
 */
type Simulacion = 'dentro' | 'fuera' | 'sin-gps'

const SIMULACIONES: { valor: Simulacion; texto: string }[] = [
  { valor: 'dentro', texto: 'En el recinto' },
  { valor: 'fuera', texto: 'A 1,2 km' },
  { valor: 'sin-gps', texto: 'Sin GPS' },
]

export default function Vista() {
  const { estado, aplicar } = useDemo()
  const [simulacion, setSimulacion] = useState<Simulacion>('dentro')

  const yo = estado.perfiles.find((p) => p.id === estado.yo)!
  const centro = estado.centros.find((c) => c.id === yo.centro_id) ?? null
  const mios = estado.fichajes.filter((f) => f.empleado_id === yo.id)
  const turnos = estado.turnos.filter((t) => t.empleado_id === yo.id && t.estado !== 'cancelado')
  const turnosHoy = turnos.filter((t) => t.fecha === HOY)
  const manana = turnos.find((t) => t.fecha === sumarDias(HOY, 1))
  const avisos = estado.avisos.filter(
    (a) => (a.destinatario_id ?? a.empleado_id) === yo.id && a.leido_en === null,
  )

  async function posicionSimulada(): Promise<{ pos: Posicion } | { error: string }> {
    if (simulacion === 'sin-gps') return { error: 'Has denegado el permiso de ubicación' }
    if (!centro?.lat || !centro.lon) return { error: 'El centro no tiene coordenadas' }
    // Unos 19 m del centro, o unos 1,2 km desplazando la latitud.
    const desplazamiento = simulacion === 'dentro' ? 0.000109 : 0.0108
    return {
      pos: {
        lat: centro.lat + desplazamiento,
        lon: centro.lon + (simulacion === 'dentro' ? 0.000175 : 0),
        precision_m: 14,
      },
    }
  }

  const distanciaSimulada =
    centro?.lat && centro.lon && simulacion !== 'sin-gps'
      ? Math.round(
          distanciaM(
            centro.lat,
            centro.lon,
            centro.lat + (simulacion === 'dentro' ? 0.000109 : 0.0108),
            centro.lon + (simulacion === 'dentro' ? 0.000175 : 0),
          ),
        )
      : null

  return (
    <>
      <header className="cabecera">
        <div className="cabecera-inner">
          <div className="crece">
            <Marca />
            <h1>Hola, {yo.nombre.split(' ')[0]}</h1>

          </div>
          <span className="btn mini" aria-hidden>
            Salir
          </span>
        </div>
      </header>

      <main className="pagina">
        {avisos.map((a) => (
          <AvisoBanner
            key={a.id}
            aviso={a}
            alMarcar={(id) => aplicar((e) => marcarAvisoDemo(e, id))}
          />
        ))}

        <div className="tarjeta plana columna" style={{ gap: 8 }}>
          <div className="fila entre">
            <h3>Ubicación simulada</h3>
            {distanciaSimulada !== null && (
              <span
                className={`pill ${
                  centro && distanciaSimulada <= centro.radio_m ? 'ok' : 'error'
                } mono`}
              >
                {distanciaSimulada} m
              </span>
            )}
          </div>
          <div className="fila" style={{ gap: 8 }}>
            {SIMULACIONES.map((s) => (
              <button
                key={s.valor}
                type="button"
                className={`btn mini crece ${simulacion === s.valor ? 'primario' : ''}`}
                onClick={() => setSimulacion(s.valor)}
              >
                {s.texto}
              </button>
            ))}
          </div>
          <p className="mini suave">
            El navegador de aquí no da GPS, así que eliges tú desde dónde fichas. Con «A 1,2 km» el
            fichaje se registra igual y le salta el aviso al administrador.
          </p>
        </div>

        <Reloj
          fichajes={mios}
          obtenerPosicion={posicionSimulada}
          tz={TZ}
          centro={
            centro
              ? {
                  nombre: centro.nombre,
                  radio_m: centro.radio_m,
                  lat: centro.lat,
                  lon: centro.lon,
                }
              : null
          }
          demo={(tipo: TipoFichaje, pos) => aplicar((e) => ficharDemo(e, e.yo, tipo, pos))}
        />

        <div className="tarjeta">
          <header>
            <h2>Tu turno</h2>
            <Link href="/demo/turnos" className="mini">
              Mi horario
            </Link>
          </header>
          {turnosHoy.length === 0 && !manana && <p className="vacio">No tienes turnos hoy</p>}
          {turnosHoy.map((t) => (
            <div key={t.id} className="item">
              <span className="crece">
                Hoy · {t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}
                {t.pausa_min > 0 && <span className="suave"> ({t.pausa_min} min de pausa)</span>}
              </span>
              <span className="pill marca mono">{formatMinutos(minutosTurno(t))}</span>
            </div>
          ))}
          {manana && (
            <div className="item suave pequeno">
              Mañana · {manana.hora_inicio.slice(0, 5)}–{manana.hora_fin.slice(0, 5)}
            </div>
          )}
        </div>

        <p className="mini suave centrado">
          Tu ubicación se registra solo en el momento de fichar, para comprobar que estás en el
          centro de trabajo. No se hace seguimiento durante la jornada.
        </p>

        <p className="centrado">
          <ReiniciarDemo />
        </p>
      </main>
    </>
  )
}
