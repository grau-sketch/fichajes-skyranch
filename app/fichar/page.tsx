import Link from 'next/link'
import AvisoBanner from '@/components/AvisoBanner'
import AvisosPush from '@/components/AvisosPush'
import Cabecera from '@/components/Cabecera'
import Reloj from '@/components/Reloj'
import { TOLERANCIA_ENTRADA_MIN, TZ } from '@/lib/constants'
import { formatMinutos, hoyLocal, instanteLocal, sumarDias } from '@/lib/fechas'
import { minutosTurno } from '@/lib/jornada'
import { requerirPerfil } from '@/lib/sesion'
import { createClient } from '@/lib/supabase/server'
import type { Aviso, Centro, Fichaje, Turno } from '@/lib/types'

export const metadata = { title: 'Fichar' }
export const dynamic = 'force-dynamic'

export default async function Fichar() {
  const perfil = await requerirPerfil()
  const supabase = createClient()
  const hoy = hoyLocal()

  // 48 h de margen para reconstruir jornadas que cruzan medianoche.
  const desde = new Date(Date.now() - 48 * 3600 * 1000).toISOString()

  const [resFichajes, resCentro, resTurnos, resAvisos] = await Promise.all([
    supabase
      .from('fichajes')
      .select('*')
      .eq('empleado_id', perfil.id)
      .gte('ts', desde)
      .order('ts', { ascending: true }),
    perfil.centro_id
      ? supabase.from('centros').select('*').eq('id', perfil.centro_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('turnos')
      .select('*')
      .eq('empleado_id', perfil.id)
      .in('fecha', [hoy, sumarDias(hoy, 1)])
      .neq('estado', 'cancelado')
      .order('fecha')
      .order('hora_inicio'),
    supabase
      .from('avisos')
      .select('*')
      // Los dirigidos a mí, o los míos sin destinatario explícito.
      .or(`destinatario_id.eq.${perfil.id},and(destinatario_id.is.null,empleado_id.eq.${perfil.id})`)
      .is('leido_en', null)
      .order('enviado_en', { ascending: false })
      .limit(4),
  ])

  const fichajes = (resFichajes.data ?? []) as Fichaje[]
  const centro = (resCentro.data ?? null) as Centro | null
  const turnos = (resTurnos.data ?? []) as Turno[]
  const avisos = (resAvisos.data ?? []) as Aviso[]
  const tz = centro?.tz ?? TZ

  const turnosHoy = turnos.filter((t) => t.fecha === hoy)
  const proximo = turnos.find((t) => instanteLocal(t.fecha, t.hora_inicio, tz) > new Date())
  const yaFichoHoy = fichajes.some((f) => f.ts >= `${hoy}T00:00:00`)

  const inicioHoy = turnosHoy[0]
  const tarde =
    inicioHoy &&
    !yaFichoHoy &&
    Date.now() - instanteLocal(inicioHoy.fecha, inicioHoy.hora_inicio, tz).getTime() >
      TOLERANCIA_ENTRADA_MIN * 60000

  return (
    <>
      <Cabecera titulo={`Hola, ${perfil.nombre.split(' ')[0]}`} subtitulo={perfil.email ?? ''} />
      <main className="pagina">
        {avisos.map((a) => (
          <AvisoBanner key={a.id} aviso={a} />
        ))}

        {tarde && (
          <p className="nota error">
            Tu turno empezaba a las {inicioHoy.hora_inicio.slice(0, 5)} y aún no has fichado.
          </p>
        )}

        <Reloj
          fichajes={fichajes}
          tz={tz}
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
        />

        <div className="tarjeta">
          <header>
            <h2>Tu turno</h2>
            <Link href="/turnos" className="mini">
              Mi horario
            </Link>
          </header>
          {turnosHoy.length === 0 && !proximo && (
            <p className="vacio">No tienes turnos planificados</p>
          )}
          {turnosHoy.map((t) => (
            <div key={t.id} className="item">
              <span className="crece">
                Hoy · {t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}
                {t.pausa_min > 0 && <span className="suave"> ({t.pausa_min} min de pausa)</span>}
              </span>
              <span className="pill marca mono">{formatMinutos(minutosTurno(t))}</span>
            </div>
          ))}
          {proximo && proximo.fecha !== hoy && (
            <div className="item suave pequeno">
              Mañana · {proximo.hora_inicio.slice(0, 5)}–{proximo.hora_fin.slice(0, 5)}
            </div>
          )}
        </div>

        <AvisosPush vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

        <p className="mini suave centrado">
          Tu ubicación se registra solo en el momento de fichar, para comprobar que estás en el
          centro de trabajo. No se hace seguimiento durante la jornada.
        </p>
      </main>
    </>
  )
}
