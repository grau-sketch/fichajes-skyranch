'use client'

import { useEffect } from 'react'

/**
 * Registra el service worker y, cuando entra una versión nueva, recarga una
 * sola vez.
 *
 * Sin esto había que recargar dos veces después de cada despliegue: el worker
 * nuevo tomaba el control pero la pestaña seguía ejecutando los chunks del
 * anterior. La recarga se limita a los relevos de verdad — en la primera
 * instalación no había nada que reemplazar, así que no se recarga.
 */
export default function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const habiaControlador = Boolean(navigator.serviceWorker.controller)
    let recargando = false

    const alCambiarControlador = () => {
      if (!habiaControlador || recargando) return
      recargando = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControlador)

    const registrar = async () => {
      try {
        const registro = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        // Preguntar por una versión nueva en cada arranque: el navegador lo
        // hace por su cuenta, pero no siempre a tiempo para esta visita.
        registro.update().catch(() => {})
      } catch {
        // Sin service worker la app sigue funcionando online.
      }
    }

    if (document.readyState === 'complete') registrar()
    else window.addEventListener('load', registrar, { once: true })

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiarControlador)
    }
  }, [])

  return null
}
