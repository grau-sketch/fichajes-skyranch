'use client'

import { useEffect, useState } from 'react'
import TecladoPin from '@/components/TecladoPin'
import {
  LONGITUD_PIN,
  borrarPin,
  guardarPin,
  marcarAbierto,
  pinConfigurado,
  pinDebil,
  pinValido,
} from '@/lib/pin'

/**
 * Crear o quitar el PIN de este dispositivo. Aparece plegado: quien no lo
 * quiera no lo ve, y quien lo quiera lo tiene en dos toques.
 */
export default function AjustePin({ nombre }: { nombre: string }) {
  const [tiene, setTiene] = useState<boolean | null>(null)
  const [paso, setPaso] = useState<'primero' | 'repetir'>('primero')
  const [primero, setPrimero] = useState('')
  const [valor, setValor] = useState('')
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)

  useEffect(() => setTiene(Boolean(pinConfigurado())), [])

  useEffect(() => {
    if (valor.length !== LONGITUD_PIN) return

    if (paso === 'primero') {
      if (!pinValido(valor)) {
        setMsg({ error: 'El PIN son cuatro cifras' })
        setValor('')
        return
      }
      const flojo = pinDebil(valor)
      if (flojo) {
        setMsg({ error: `${flojo}. Elige otro.` })
        setValor('')
        return
      }
      setPrimero(valor)
      setValor('')
      setPaso('repetir')
      setMsg(null)
      return
    }

    if (valor !== primero) {
      setMsg({ error: 'No coinciden. Empieza otra vez.' })
      setPrimero('')
      setValor('')
      setPaso('primero')
      return
    }

    void guardarPin(valor, nombre).then(() => {
      marcarAbierto()
      setTiene(true)
      setPrimero('')
      setValor('')
      setPaso('primero')
      setMsg({ ok: 'PIN guardado. La próxima vez que abras la app te lo pedirá.' })
    })
  }, [valor, paso, primero, nombre])

  if (tiene === null) return null

  if (tiene) {
    return (
      <div className="tarjeta plana fila entre">
        <span className="pill ok">
          <span className="punto" />
          Acceso rápido activado
        </span>
        <button
          type="button"
          className="btn mini"
          onClick={() => {
            if (!window.confirm('¿Quitar el PIN de este dispositivo?')) return
            borrarPin()
            setTiene(false)
            setMsg(null)
          }}
        >
          Quitar PIN
        </button>
      </div>
    )
  }

  return (
    <details className="tarjeta">
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Entrar más rápido con un PIN</summary>
      <p className="pequeno suave" style={{ margin: '10px 0 18px' }}>
        Cuatro cifras para abrir la app en este móvil sin escribir tu nombre y tu contraseña. Es
        una comodidad, no una contraseña: si pierdes el teléfono, lo que protege tus datos sigue
        siendo tu contraseña.
      </p>

      <div className="columna" style={{ gap: 16, alignItems: 'center' }}>
        <p className="pequeno">
          {paso === 'primero' ? 'Elige tu PIN' : 'Repítelo para confirmar'}
        </p>
        <TecladoPin valor={valor} onCambio={setValor} />
        {msg?.error && <p className="nota error">{msg.error}</p>}
        {msg?.ok && <p className="nota ok">{msg.ok}</p>}
      </div>
    </details>
  )
}
