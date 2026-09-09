import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'
import type { Perfil } from './types'

/** Perfil del usuario de la sesión, o redirige a /login. */
export async function requerirPerfil(): Promise<Perfil> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre, email, rol, centro_id, horas_semana, activo')
    .eq('id', user.id)
    .single()

  if (!data) redirect('/login?error=sin-perfil')
  return data as Perfil
}

/** Igual que requerirPerfil pero exige rol de gestión. */
export async function requerirGestor(): Promise<Perfil> {
  const perfil = await requerirPerfil()
  if (perfil.rol === 'empleado') redirect('/fichar')
  return perfil
}

export function esGestor(perfil: Perfil): boolean {
  return perfil.rol === 'admin' || perfil.rol === 'encargado'
}
