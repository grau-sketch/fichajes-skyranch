import 'server-only'
import { enviarPush, type Suscripcion } from './push'
import { createAdminClient } from './supabase/admin'

/**
 * Envía por push los avisos que la base acaba de crear para un fichaje.
 * Necesita service_role porque un empleado no puede leer las suscripciones de
 * sus responsables. Nunca lanza: si falla el push, el fichaje ya está guardado
 * y el aviso sigue visible en el panel.
 */
export async function notificarAvisosDeFichaje(fichajeId: string): Promise<number> {
  try {
    const admin = createAdminClient()

    const { data: avisos } = await admin
      .from('avisos')
      .select('destinatario_id, empleado_id, titulo, cuerpo, tipo')
      .eq('fichaje_id', fichajeId)

    if (!avisos || avisos.length === 0) return 0

    const destinatarios = [
      ...new Set(
        avisos.map((a) => (a.destinatario_id ?? a.empleado_id) as string),
      ),
    ]

    const { data: subs } = await admin
      .from('push_suscripciones')
      .select('empleado_id, endpoint, p256dh, auth')
      .in('empleado_id', destinatarios)

    if (!subs || subs.length === 0) return 0

    let enviados = 0
    const caducados: string[] = []

    for (const aviso of avisos) {
      const quien = (aviso.destinatario_id ?? aviso.empleado_id) as string
      const suyas: Suscripcion[] = subs
        .filter((s) => s.empleado_id === quien)
        .map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }))
      if (suyas.length === 0) continue

      const envio = await enviarPush(suyas, {
        titulo: aviso.titulo,
        cuerpo: aviso.cuerpo,
        url: aviso.tipo === 'fichaje_fuera_radio' ? '/admin' : '/fichar',
        tag: `${aviso.tipo}-${fichajeId}`,
      })
      enviados += envio.enviados
      caducados.push(...envio.caducados)
    }

    if (caducados.length > 0) {
      await admin.from('push_suscripciones').delete().in('endpoint', caducados)
    }

    return enviados
  } catch {
    return 0
  }
}
