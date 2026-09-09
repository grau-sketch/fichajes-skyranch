'use client'

import { useState } from 'react'
import { solicitarAusencia } from '@/app/actions'
import {
  AUSENCIAS_SOLICITABLES,
  ETIQUETA_AUSENCIA,
  TIPOS_AUSENCIA,
  type TipoAusencia,
} from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

const MAX_BYTES = 8 * 1024 * 1024

/**
 * Solicitud de ausencia. El justificante se sube directamente al bucket
 * privado, dentro de la carpeta de la propia persona; a la acción solo le llega
 * la ruta, nunca el archivo.
 */
export default function PedirAusencia({
  empleadoId,
  comoGestor = false,
  demo,
}: {
  empleadoId: string
  /** Un responsable puede registrar faltas y darlas por aprobadas. */
  comoGestor?: boolean
  demo?: (form: FormData) => { ok?: string; error?: string }
}) {
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)

  const tipos: readonly TipoAusencia[] = comoGestor ? TIPOS_AUSENCIA : AUSENCIAS_SOLICITABLES

  async function alEnviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const datos = new FormData(formulario)
    setEnviando(true)
    setMsg(null)

    try {
      if (archivo) {
        if (archivo.size > MAX_BYTES) {
          setMsg({ error: 'El justificante no puede pasar de 8 MB' })
          return
        }
        if (demo) {
          datos.set('justificante', `${empleadoId}/demo-${archivo.name}`)
        } else {
          const supabase = createClient()
          const ext = archivo.name.split('.').pop()?.toLowerCase() ?? 'bin'
          const ruta = `${empleadoId}/${crypto.randomUUID()}.${ext}`
          const { error } = await supabase.storage
            .from('justificantes')
            .upload(ruta, archivo, { contentType: archivo.type || undefined })
          if (error) {
            setMsg({ error: 'No se ha podido subir el justificante' })
            return
          }
          datos.set('justificante', ruta)
        }
      }

      const respuesta = demo ? demo(datos) : await solicitarAusencia(null, datos)
      setMsg(respuesta ?? null)
      if (respuesta && !respuesta.error) {
        formulario.reset()
        setArchivo(null)
      }
    } catch {
      setMsg({ error: 'Sin conexión o error del servidor' })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={alEnviar} className="columna">
      <input type="hidden" name="empleado_id" value={comoGestor ? empleadoId : ''} />
      <div>
        <label htmlFor="a-tipo">Tipo</label>
        <select id="a-tipo" name="tipo" defaultValue={tipos[0]} required>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_AUSENCIA[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="campos dos">
        <div>
          <label htmlFor="a-desde">Desde</label>
          <input id="a-desde" name="desde" type="date" required />
        </div>
        <div>
          <label htmlFor="a-hasta">Hasta</label>
          <input id="a-hasta" name="hasta" type="date" required />
        </div>
      </div>
      <div>
        <label htmlFor="a-motivo">Motivo (opcional)</label>
        <input id="a-motivo" name="motivo" placeholder="Boda de mi hermana" />
      </div>
      <div>
        <label htmlFor="a-justificante">Justificante (opcional)</label>
        <input
          id="a-justificante"
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          style={{ padding: 9 }}
        />
        <p className="mini suave" style={{ marginTop: 6 }}>
          Foto o PDF, hasta 8 MB. Se guarda en privado y solo lo ve tu responsable.
        </p>
      </div>
      <button type="submit" className="btn primario" disabled={enviando}>
        {enviando ? 'Enviando…' : comoGestor ? 'Registrar ausencia' : 'Pedir ausencia'}
      </button>
      {msg?.error && <p className="nota error">{msg.error}</p>}
      {msg?.ok && <p className="nota ok">{msg.ok}</p>}
    </form>
  )
}
