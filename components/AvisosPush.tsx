'use client'

import { useEffect, useState } from 'react'
import { borrarSuscripcion, guardarSuscripcion } from '@/app/actions'

function base64UrlAUint8(base64: string) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const normal = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(normal)
  // Sobre un ArrayBuffer explícito: es lo que espera applicationServerKey.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length))
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i)
  return bytes
}

type Situacion =
  | 'cargando'
  | 'activo'
  | 'inactivo'
  | 'denegado'
  | 'no-soportado'
  | 'requiere-instalar'

export default function AvisosPush({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [situacion, setSituacion] = useState<Situacion>('cargando')
  const [error, setError] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    async function comprobar() {
      if (typeof window === 'undefined') return
      const enPantallaInicio =
        window.matchMedia('(display-mode: standalone)').matches ||
        // Safari en iOS expone navigator.standalone.
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        // En iOS el push solo existe si la app está en la pantalla de inicio.
        setSituacion(enPantallaInicio ? 'no-soportado' : 'requiere-instalar')
        return
      }
      if (Notification.permission === 'denied') {
        setSituacion('denegado')
        return
      }
      const registro = await navigator.serviceWorker.ready
      const actual = await registro.pushManager.getSubscription()
      setSituacion(actual ? 'activo' : 'inactivo')
    }
    void comprobar().catch(() => setSituacion('no-soportado'))
  }, [])

  async function activar() {
    if (!vapidPublicKey) {
      setError('Los avisos no están configurados en el servidor (falta la clave VAPID)')
      return
    }
    setTrabajando(true)
    setError(null)
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') {
        setSituacion(permiso === 'denied' ? 'denegado' : 'inactivo')
        return
      }
      const registro = await navigator.serviceWorker.ready
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlAUint8(vapidPublicKey),
      })
      const json = suscripcion.toJSON() as { keys?: { p256dh?: string; auth?: string } }
      if (!json.keys?.p256dh || !json.keys.auth) throw new Error('suscripción incompleta')

      const r = await guardarSuscripcion({
        endpoint: suscripcion.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 200),
      })
      if (!r.ok) throw new Error(r.error)
      setSituacion('activo')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se han podido activar los avisos')
    } finally {
      setTrabajando(false)
    }
  }

  async function desactivar() {
    setTrabajando(true)
    try {
      const registro = await navigator.serviceWorker.ready
      const actual = await registro.pushManager.getSubscription()
      if (actual) {
        await borrarSuscripcion(actual.endpoint)
        await actual.unsubscribe()
      }
      setSituacion('inactivo')
    } catch {
      setError('No se han podido desactivar')
    } finally {
      setTrabajando(false)
    }
  }

  if (situacion === 'cargando') return null

  if (situacion === 'activo') {
    return (
      <div className="fila entre pequeno suave">
        <span className="pill ok">
          <span className="punto" />
          Avisos activados
        </span>
        <button type="button" className="btn mini" onClick={desactivar} disabled={trabajando}>
          Desactivar
        </button>
      </div>
    )
  }

  return (
    <div className="tarjeta plana columna" style={{ gap: 8 }}>
      <div className="fila entre">
        <h3>Avisos de fichaje</h3>
      </div>
      {situacion === 'inactivo' && (
        <>
          <p className="pequeno suave">
            Te avisamos si se te pasa fichar la entrada o si te dejas la jornada abierta.
          </p>
          <button type="button" className="btn" onClick={activar} disabled={trabajando}>
            {trabajando ? 'Activando…' : 'Activar avisos'}
          </button>
        </>
      )}
      {situacion === 'requiere-instalar' && (
        <p className="pequeno suave">
          Para recibir avisos en iPhone: toca Compartir y luego «Añadir a pantalla de inicio». Abre
          la app desde ese icono y vuelve aquí.
        </p>
      )}
      {situacion === 'denegado' && (
        <p className="pequeno suave">
          Has bloqueado las notificaciones. Actívalas en los ajustes del navegador para este sitio.
        </p>
      )}
      {situacion === 'no-soportado' && (
        <p className="pequeno suave">Este navegador no admite avisos push.</p>
      )}
      {error && <p className="nota error">{error}</p>}
    </div>
  )
}
