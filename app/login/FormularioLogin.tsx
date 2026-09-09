'use client'

import { useState } from 'react'
import { entrar } from '@/app/actions'

export default function FormularioLogin({ destino }: { destino: string }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const datos = new FormData(evento.currentTarget)
    setEnviando(true)
    setError(null)
    try {
      const respuesta = await entrar(null, datos)
      if (respuesta?.error) setError(respuesta.error)
    } catch {
      setError('Sin conexión. Comprueba la red e inténtalo otra vez.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={alEnviar} className="columna" style={{ gap: 14 }}>
      <input type="hidden" name="redirect" value={destino} />
      <div>
        <label htmlFor="nombre">Nombre y apellido</label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          inputMode="text"
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          required
          placeholder="Gilenis Pérez"
        />
      </div>
      <div>
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <button type="submit" className="btn primario bloque" disabled={enviando}>
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
      {error && <p className="nota error">{error}</p>}
      <p className="mini suave centrado">
        La contraseña te la da tu responsable. Si no la recuerdas, pídesela.
      </p>
    </form>
  )
}
