'use client'

import { useState } from 'react'
import { guardarParte } from '@/app/actions'

/**
 * Qué se ha hecho hoy. En una finca esto vale más que las horas: la nómina se
 * paga por tiempo, pero el trabajo se organiza por tareas.
 */
export default function ParteTrabajo({
  fecha,
  texto = '',
  demo,
}: {
  fecha: string
  texto?: string
  demo?: (form: FormData) => { ok?: string; error?: string }
}) {
  const [valor, setValor] = useState(texto)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const cambiado = valor.trim() !== texto.trim()

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const datos = new FormData(evento.currentTarget)
    setEnviando(true)
    setMsg(null)
    try {
      const respuesta = demo ? demo(datos) : await guardarParte(null, datos)
      setMsg(respuesta ?? null)
    } catch {
      setMsg({ error: 'Sin conexión o error del servidor' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tarjeta">
      <header>
        <h2>Parte del día</h2>
      </header>
      <form onSubmit={alEnviar} className="columna">
        <input type="hidden" name="fecha" value={fecha} />
        <textarea
          name="texto"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Riego del olivar, reparación de la valla norte…"
          style={{ resize: 'vertical', lineHeight: 1.45, paddingTop: 12 }}
        />
        <button type="submit" className="btn" disabled={enviando || !cambiado}>
          {enviando ? 'Guardando…' : cambiado ? 'Guardar parte' : 'Guardado'}
        </button>
        {msg?.error && <p className="nota error">{msg.error}</p>}
        {msg?.ok && <p className="nota ok">{msg.ok}</p>}
      </form>
    </div>
  )
}
