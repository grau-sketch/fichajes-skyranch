'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  estadoInicial,
  type EstadoDemo,
  type Resultado as ResultadoDemo,
} from '@/lib/demoEstado'

// Al subir la versión se descarta el estado guardado de versiones anteriores.
const CLAVE = 'fichajes:demo:v2'

type Contexto = {
  estado: EstadoDemo
  /** Aplica una operación y guarda. Devuelve el mensaje o el error. */
  aplicar: (op: (e: EstadoDemo) => ResultadoDemo) => { ok?: string; error?: string }
  reiniciar: () => void
  /** false hasta que se ha leído lo guardado en el navegador. */
  listo: boolean
}

const Ctx = createContext<Contexto | null>(null)

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoDemo>(estadoInicial)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE)
      if (guardado) setEstado(JSON.parse(guardado) as EstadoDemo)
    } catch {
      // Modo privado o datos corruptos: se sigue con el estado inicial.
    }
    setListo(true)
  }, [])

  const guardar = useCallback((siguiente: EstadoDemo) => {
    setEstado(siguiente)
    try {
      localStorage.setItem(CLAVE, JSON.stringify(siguiente))
    } catch {
      // Sin almacenamiento la demo sigue funcionando, solo no persiste.
    }
  }, [])

  const aplicar = useCallback<Contexto['aplicar']>(
    (op) => {
      const r = op(estado)
      if (!r.ok) return { error: r.error }
      guardar(r.estado)
      return { ok: r.mensaje ?? 'Guardado' }
    },
    [estado, guardar],
  )

  const reiniciar = useCallback(() => {
    try {
      localStorage.removeItem(CLAVE)
    } catch {
      // ignorado a propósito
    }
    guardar(estadoInicial())
  }, [guardar])

  // Hasta que no se ha leído el navegador no se pinta nada: el estado inicial
  // depende de la hora actual y en el servidor no coincidiría con el cliente.
  if (!listo) {
    return (
      <main className="pagina" style={{ paddingTop: 48 }}>
        <p className="vacio">Preparando la demo…</p>
      </main>
    )
  }

  return <Ctx.Provider value={{ estado, aplicar, reiniciar, listo }}>{children}</Ctx.Provider>
}

export function useDemo(): Contexto {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDemo fuera de DemoProvider')
  return ctx
}
