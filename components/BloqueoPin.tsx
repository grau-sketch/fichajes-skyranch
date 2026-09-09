'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sello from '@/components/Sello'
import TecladoPin from '@/components/TecladoPin'
import {
  LONGITUD_PIN,
  borrarPin,
  comprobarPin,
  estaAbierto,
  marcarAbierto,
  pinConfigurado,
} from '@/lib/pin'

const MAX_FALLOS = 5

/**
 * Cierre de la app con el PIN. Solo aparece si hay PIN configurado en este
 * dispositivo y la pestaña se acaba de abrir. No sustituye a la sesión: si la
 * sesión caducó, detrás sigue estando la pantalla de acceso.
 */
export default function BloqueoPin() {
  const ruta = usePathname()
  const [cerrado, setCerrado] = useState(false)
  const [nombre, setNombre] = useState('')
  const [valor, setValor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fallos, setFallos] = useState(0)

  useEffect(() => {
    // En la pantalla de acceso no se bloquea nada: no hay nada que proteger.
    if (ruta === '/login') return
    const guardado = pinConfigurado()
    if (guardado && !estaAbierto()) {
      setNombre(guardado.nombre)
      setCerrado(true)
    }
  }, [ruta])

  useEffect(() => {
    if (valor.length !== LONGITUD_PIN) return
    let vivo = true
    void (async () => {
      const bien = await comprobarPin(valor)
      if (!vivo) return
      if (bien) {
        marcarAbierto()
        setCerrado(false)
        setValor('')
        setError(null)
        setFallos(0)
      } else {
        const n = fallos + 1
        setFallos(n)
        setValor('')
        setError(
          n >= MAX_FALLOS
            ? 'Demasiados intentos. Entra con tu nombre y contraseña.'
            : `PIN incorrecto. Te quedan ${MAX_FALLOS - n} intentos.`,
        )
      }
    })()
    return () => {
      vivo = false
    }
  }, [valor, fallos])

  if (!cerrado) return null

  const agotado = fallos >= MAX_FALLOS

  return (
    <div className="bloqueo-pin">
      <div className="columna" style={{ gap: 18, alignItems: 'center', width: '100%' }}>
        <Sello tamano={72} />
        <div className="centrado">
          <h1 style={{ fontSize: 24 }}>Hola, {nombre.split(' ')[0]}</h1>
          <p className="pequeno suave">
            {agotado ? 'Entra con tu contraseña' : 'Escribe tu PIN para entrar'}
          </p>
        </div>

        {!agotado && (
          <TecladoPin valor={valor} onCambio={(v) => setValor(v)} deshabilitado={agotado} />
        )}

        {error && (
          <p className={`nota ${agotado ? 'error' : 'aviso'}`} style={{ maxWidth: 320 }}>
            {error}
          </p>
        )}

        <button
          type="button"
          className="btn mini"
          onClick={() => {
            borrarPin()
            window.location.href = '/login'
          }}
        >
          Entrar con nombre y contraseña
        </button>
      </div>
    </div>
  )
}
