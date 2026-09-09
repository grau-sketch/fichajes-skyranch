'use client'

import { useState } from 'react'

const SILABAS = ['ba', 'te', 'ro', 'mi', 'lu', 'sa', 'ne', 'to', 'ca', 'pi', 'de', 'go']

/** Contraseña temporal: legible para dictarla por teléfono y de 10+ caracteres. */
function generar(): string {
  const aleatorio = (n: number) => Math.floor(Math.random() * n)
  const palabra = Array.from({ length: 3 }, () => SILABAS[aleatorio(SILABAS.length)]).join('')
  return `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}-${100 + aleatorio(900)}`
}

export default function CampoPassword({
  id,
  etiqueta = 'Contraseña temporal',
  ayuda,
}: {
  id: string
  etiqueta?: string
  ayuda?: string
}) {
  const [valor, setValor] = useState('')

  return (
    <div>
      <label htmlFor={id}>{etiqueta}</label>
      <div className="fila" style={{ gap: 8 }}>
        <input
          id={id}
          name="password"
          className="crece mono"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          minLength={8}
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="mínimo 8 caracteres"
        />
        <button type="button" className="btn" onClick={() => setValor(generar())}>
          Generar
        </button>
      </div>
      <p className="mini suave" style={{ marginTop: 6 }}>
        {ayuda ?? 'Apúntala y pásasela a la persona: no se puede volver a consultar.'}
      </p>
    </div>
  )
}
