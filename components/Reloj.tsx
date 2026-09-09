'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { registrarFichaje } from '@/app/actions'
import {
  ETIQUETA_TIPO,
  PRECISION_ACEPTABLE_M,
  SIGUIENTES,
  estadoDesdeUltimo,
  type TipoFichaje,
} from '@/lib/constants'
import { fechaLocal, formatMinutos, horaLocal } from '@/lib/fechas'
import { distanciaM, formatearDistancia, pedirPosicion } from '@/lib/geo'
import { agruparJornadas } from '@/lib/jornada'
import type { Fichaje } from '@/lib/types'

const CLAVE_COLA = 'fichajes:cola'

type EnCola = {
  tipo: TipoFichaje
  ts: string
  lat: number | null
  lon: number | null
  precision_m: number | null
}

function leerCola(): EnCola[] {
  try {
    const bruto = localStorage.getItem(CLAVE_COLA)
    return bruto ? (JSON.parse(bruto) as EnCola[]) : []
  } catch {
    return []
  }
}

function escribirCola(cola: EnCola[]): void {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(cola))
  } catch {
    // Modo privado o almacenamiento lleno: la cola se pierde, no la app.
  }
}

export default function Reloj({
  fichajes: inicial,
  centro,
  tz,
  demo,
  obtenerPosicion = pedirPosicion,
}: {
  fichajes: Fichaje[]
  centro: {
    nombre: string
    radio_m: number
    lat: number | null
    lon: number | null
  } | null
  tz: string
  /**
   * Manejador local de la demo: recibe el tipo y la posición y registra el
   * fichaje en el estado de la demo en lugar de llamar al servidor.
   */
  demo?: (
    tipo: TipoFichaje,
    pos: { lat: number; lon: number; precision_m: number } | null,
  ) => { ok?: string; error?: string }
  /**
   * De dónde sale la ubicación. Por defecto el GPS del dispositivo; la demo
   * inyecta una posición simulada para poder probar los dos casos.
   */
  obtenerPosicion?: typeof pedirPosicion
}) {
  const [fichajes, setFichajes] = useState<Fichaje[]>(inicial)
  const [ahora, setAhora] = useState<Date | null>(null)
  const [ocupado, setOcupado] = useState<TipoFichaje | null>(null)
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error' | 'aviso'; texto: string } | null>(null)
  const [cola, setCola] = useState<EnCola[]>([])
  const [confirmacion, setConfirmacion] = useState<{
    tipo: TipoFichaje
    pos: { lat: number; lon: number; precision_m: number }
    distancia: number
  } | null>(null)

  useEffect(() => {
    setAhora(new Date())
    const id = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => setCola(leerCola()), [])

  // Si el servidor (o la demo) manda fichajes nuevos, se adoptan.
  useEffect(() => setFichajes(inicial), [inicial])

  const ultimo: TipoFichaje | null = useMemo(() => {
    const orden = [...fichajes].sort((a, b) => b.ts.localeCompare(a.ts))
    return orden[0]?.tipo ?? null
  }, [fichajes])

  const estado = estadoDesdeUltimo(ultimo)
  const permitidos = SIGUIENTES[ultimo ?? 'ninguno']

  const { abierta, minutosHoy } = useMemo(() => {
    const ref = ahora ?? new Date()
    const jornadas = agruparJornadas(fichajes, ref, tz)
    const hoy = fechaLocal(ref, tz)
    return {
      abierta: jornadas.find((j) => j.abierta) ?? null,
      minutosHoy: jornadas
        .filter((j) => j.fecha === hoy)
        .reduce((s, j) => s + j.minutos_trabajados, 0),
    }
  }, [fichajes, ahora, tz])

  const deHoy = useMemo(() => {
    if (!ahora) return []
    const hoy = fechaLocal(ahora, tz)
    return fichajes
      .filter((f) => fechaLocal(f.ts, tz) === hoy)
      .sort((a, b) => b.ts.localeCompare(a.ts))
  }, [fichajes, ahora, tz])

  // --- Cola offline ---------------------------------------------------------

  const vaciarCola = useCallback(async () => {
    const pendientes = leerCola()
    if (pendientes.length === 0) return
    const quedan: EnCola[] = []
    const nuevos: Fichaje[] = []

    for (const p of pendientes) {
      try {
        const r = await registrarFichaje({ ...p, ts: p.ts })
        if (r.ok) nuevos.push(r.datos)
        // Si el servidor lo rechaza (p. ej. transición inválida) se descarta:
        // reintentarlo eternamente bloquearía el resto de la cola.
      } catch {
        quedan.push(p)
      }
    }

    escribirCola(quedan)
    setCola(quedan)
    if (nuevos.length > 0) {
      setFichajes((prev) => [...prev, ...nuevos])
      setAviso({ tono: 'ok', texto: `${nuevos.length} fichaje(s) pendiente(s) enviado(s)` })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void vaciarCola()
    const alVolver = () => void vaciarCola()
    window.addEventListener('online', alVolver)
    return () => window.removeEventListener('online', alVolver)
  }, [vaciarCola])

  // --- Fichar ---------------------------------------------------------------

  /**
   * Paso 1: pedir la ubicación. Es obligatoria — sin ella no se ficha, porque
   * el fichaje tiene que poder verificarse contra el centro de trabajo.
   * Si la posición cae fuera del recinto no se bloquea: se pregunta.
   */
  async function fichar(tipo: TipoFichaje) {
    setOcupado(tipo)
    setAviso(null)

    const resultado = await obtenerPosicion()

    if ('error' in resultado) {
      setAviso({
        tono: 'error',
        texto: `${resultado.error}. Sin ubicación no se puede fichar: activa el permiso y vuelve a intentarlo. Si no lo consigues, pide a tu responsable que registre el fichaje.`,
      })
      setOcupado(null)
      return
    }

    const pos = resultado.pos

    if (centro?.lat != null && centro.lon != null) {
      const distancia = distanciaM(centro.lat, centro.lon, pos.lat, pos.lon)
      // El margen de error del GPS cuenta a favor de la persona, igual que en
      // el servidor. Si aun así queda fuera, se pregunta antes de enviar.
      const dentro = distancia <= centro.radio_m + Math.min(pos.precision_m, 100)
      if (!dentro) {
        setConfirmacion({ tipo, pos, distancia })
        setOcupado(null)
        return
      }
    }

    await enviar(tipo, pos)
  }

  /** Paso 2: enviar el fichaje, ya con la ubicación decidida. */
  async function enviar(tipo: TipoFichaje, pos: { lat: number; lon: number; precision_m: number }) {
    setOcupado(tipo)
    setConfirmacion(null)

    if (demo) {
      const r = demo(tipo, pos)
      setAviso(
        r.error
          ? { tono: 'error', texto: r.error }
          : {
              tono: r.ok && r.ok !== 'Guardado' ? 'aviso' : 'ok',
              texto:
                r.ok && r.ok !== 'Guardado'
                  ? r.ok
                  : `${ETIQUETA_TIPO[tipo]} registrada a las ${horaLocal(new Date(), tz)}`,
            },
      )
      setOcupado(null)
      return
    }

    try {
      const r = await registrarFichaje({
        tipo,
        lat: pos.lat,
        lon: pos.lon,
        precision_m: pos.precision_m,
      })

      if (r.ok) {
        setFichajes((prev) => [...prev, r.datos])
        const d = r.datos
        setAviso(
          d.dentro_radio === false
            ? {
                tono: 'aviso',
                texto: `${ETIQUETA_TIPO[tipo]} registrada a ${formatearDistancia(
                  Number(d.distancia_m),
                )} del centro. Se ha avisado a tu responsable.`,
              }
            : {
                tono: 'ok',
                texto:
                  `${ETIQUETA_TIPO[tipo]} registrada a las ${horaLocal(d.ts, tz)}` +
                  // Si el GPS venía muy impreciso conviene que la persona lo sepa.
                  (pos.precision_m > PRECISION_ACEPTABLE_M
                    ? ` (ubicación con margen de ±${pos.precision_m} m)`
                    : ''),
              },
        )
      } else {
        setAviso({ tono: 'error', texto: r.error })
      }
    } catch {
      // Sin red: se guarda en el móvil con la hora real del fichaje.
      const pendiente: EnCola = {
        tipo,
        ts: new Date().toISOString(),
        lat: pos.lat,
        lon: pos.lon,
        precision_m: pos.precision_m,
      }
      const nueva = [...leerCola(), pendiente]
      escribirCola(nueva)
      setCola(nueva)
      setAviso({
        tono: 'aviso',
        texto: `Sin conexión. ${ETIQUETA_TIPO[tipo]} guardada en el móvil con la hora exacta; se enviará al recuperar cobertura.`,
      })
    } finally {
      setOcupado(null)
    }
  }

  const principal = permitidos[permitidos.length - 1] ?? 'entrada'
  const secundarios = permitidos.filter((t) => t !== principal)

  return (
    <div className="columna" style={{ gap: 14 }}>
      <div className="tarjeta columna" style={{ gap: 14, alignItems: 'stretch' }}>
        <div className="fila entre">
          <span
            className={`pill ${estado === 'dentro' ? 'ok' : estado === 'pausa' ? 'aviso' : ''}`}
          >
            <span className="punto" />
            {estado === 'dentro' ? 'Trabajando' : estado === 'pausa' ? 'En pausa' : 'Fuera'}
          </span>
          {centro ? (
            <span className="mini suave truncar">{centro.nombre}</span>
          ) : (
            <span className="pill aviso">Sin centro asignado</span>
          )}
        </div>

        <div className="centrado">
          <p className="cifra mono">{ahora ? formatMinutos(minutosHoy) : '—'}</p>
          <p className="mini suave">
            {abierta
              ? `Desde las ${horaLocal(abierta.entrada, tz)}${
                  abierta.minutos_pausa > 0
                    ? ` · ${formatMinutos(abierta.minutos_pausa)} de pausa`
                    : ''
                }`
              : 'Trabajado hoy'}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-fichar primario"
          onClick={() => fichar(principal)}
          disabled={ocupado !== null}
        >
          {ocupado === principal ? 'Localizando…' : ETIQUETA_TIPO[principal]}
        </button>

        {secundarios.length > 0 && (
          <div className="fila" style={{ gap: 10 }}>
            {secundarios.map((t) => (
              <button
                key={t}
                type="button"
                className="btn crece"
                onClick={() => fichar(t)}
                disabled={ocupado !== null}
              >
                {ocupado === t ? 'Localizando…' : ETIQUETA_TIPO[t]}
              </button>
            ))}
          </div>
        )}

        {aviso && <p className={`nota ${aviso.tono}`}>{aviso.texto}</p>}

        {cola.length > 0 && (
          <p className="nota aviso">
            {cola.length} fichaje(s) sin enviar. Se envían solos al volver la cobertura.{' '}
            <button type="button" className="btn mini" onClick={() => void vaciarCola()}>
              Reintentar
            </button>
          </p>
        )}

        {centro && (centro.lat === null || centro.lon === null) && (
          <p className="mini suave">
            Tu centro no tiene coordenadas configuradas, así que la ubicación se guarda pero no se
            puede comprobar.
          </p>
        )}
      </div>

      {confirmacion && (
        <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="titulo-fuera">
          <div className="modal">
            <h2 id="titulo-fuera">Estás fuera de la finca</h2>
            <p className="pequeno">
              Vas a fichar la <strong>{ETIQUETA_TIPO[confirmacion.tipo].toLowerCase()}</strong> a{' '}
              <strong>{formatearDistancia(confirmacion.distancia)}</strong> de{' '}
              {centro?.nombre ?? 'tu centro'}.
            </p>
            <p className="pequeno suave">
              Puedes registrarlo igualmente, pero quedará marcado como fichaje fuera del centro y se
              avisará a tu responsable. ¿Quieres seguir?
            </p>
            <div className="fila" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn crece"
                onClick={() => setConfirmacion(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn primario crece"
                onClick={() => void enviar(confirmacion.tipo, confirmacion.pos)}
              >
                Fichar igualmente
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tarjeta">
        <header>
          <h2>Movimientos de hoy</h2>
          {abierta && <span className="pill marca">Jornada abierta</span>}
        </header>
        {deHoy.length === 0 ? (
          <p className="vacio">Todavía no has fichado hoy</p>
        ) : (
          <div className="lista">
            {deHoy.map((f) => (
              <div key={f.id} className="item">
                <span className="mono" style={{ fontWeight: 600, minWidth: 48 }}>
                  {horaLocal(f.ts, tz)}
                </span>
                <span className="crece">{ETIQUETA_TIPO[f.tipo]}</span>
                {f.origen === 'manual' && <span className="pill">Corregido</span>}
                {f.dentro_radio === true && <span className="pill ok">En el centro</span>}
                {f.dentro_radio === false && (
                  <span className="pill error">{formatearDistancia(Number(f.distancia_m))}</span>
                )}
                {f.dentro_radio === null && <span className="pill">Sin verificar</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
