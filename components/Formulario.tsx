'use client'

import { useRef, useState } from 'react'

export type Respuesta = { ok?: string; error?: string } | void

/**
 * Formulario que llama a una Server Action y muestra su respuesta.
 * Evita useFormState para no depender de APIs experimentales de React.
 */
export default function Formulario({
  accion,
  children,
  boton = 'Guardar',
  botonClase = 'btn primario',
  limpiarAlEnviar = false,
  confirmar,
  demo,
}: {
  accion?: (previo: unknown, form: FormData) => Promise<Respuesta>
  children?: React.ReactNode
  boton?: string
  botonClase?: string
  limpiarAlEnviar?: boolean
  confirmar?: string
  /**
   * Manejador local. Si se pasa, se usa en lugar de la Server Action: es lo que
   * permite que la demo modifique su propio estado sin base de datos.
   */
  demo?: (form: FormData) => Respuesta
}) {
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const ref = useRef<HTMLFormElement>(null)

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (confirmar && !window.confirm(confirmar)) return
    const datos = new FormData(evento.currentTarget)
    setEnviando(true)
    setMsg(null)
    try {
      const respuesta = demo ? demo(datos) : accion ? await accion(null, datos) : undefined
      setMsg(respuesta ?? null)
      if (respuesta && !respuesta.error && limpiarAlEnviar) ref.current?.reset()
    } catch {
      setMsg({ error: 'Sin conexión o error del servidor' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form ref={ref} onSubmit={alEnviar} className="columna">
      {children}
      <button type="submit" className={botonClase} disabled={enviando}>
        {enviando ? 'Guardando…' : boton}
      </button>
      {msg?.error && <p className="nota error">{msg.error}</p>}
      {msg?.ok && <p className="nota ok">{msg.ok}</p>}
    </form>
  )
}
