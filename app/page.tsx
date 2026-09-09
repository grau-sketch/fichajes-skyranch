import { redirect } from 'next/navigation'
import { requerirPerfil } from '@/lib/sesion'

/** Cada rol tiene su pantalla de inicio: el admin gestiona, el resto ficha. */
export default async function Inicio() {
  const perfil = await requerirPerfil()
  redirect(perfil.rol === 'admin' ? '/admin' : '/fichar')
}
