/**
 * ¿Está Supabase configurado en este despliegue?
 *
 * Permite subir la app a Netlify antes de tener el proyecto de Supabase: en ese
 * caso la parte real queda deshabilitada con un aviso claro y la demo sigue
 * funcionando, en lugar de devolver un 500 en cada ruta.
 */
export const supabaseConfigurado = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/** La demo se puede apagar en producción con NEXT_PUBLIC_DEMO=off. */
export const demoActiva = process.env.NEXT_PUBLIC_DEMO !== 'off'
