import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con service_role. SOLO para Route Handlers de servidor (el cron de
 * avisos, que necesita leer a toda la plantilla). Nunca importar desde el front.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
