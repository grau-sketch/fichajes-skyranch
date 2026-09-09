'use client'

import { useEffect } from 'react'

/** Registra el service worker una vez cargada la app. */
export default function RegistrarSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const registrar = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Sin service worker la app sigue funcionando online.
      })
    }
    if (document.readyState === 'complete') registrar()
    else window.addEventListener('load', registrar, { once: true })
  }, [])

  return null
}
