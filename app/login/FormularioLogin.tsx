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
    <form onSubmit={alEnviar} className="columna">
      <input type="hidden" name="redirect" value={destino} />
      <div>
        <label htmlFor="email">Correo</label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="off"
          required
          placeholder="nombre@empresa.com"
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
    </form>
  )
}
