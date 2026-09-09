/**
 * Identidad de acceso a partir del nombre.
 *
 * Nadie usa correo: la persona entra con su nombre y apellido, y la contraseña
 * se la da el administrador. Como Supabase Auth necesita un identificador con
 * forma de correo, se deriva del nombre de manera determinista: no hace falta
 * consultar nada antes de intentar el acceso, así que no se filtra quién existe.
 *
 *   "Gilenis Pérez"  →  gilenis-perez@usuarios.skyranch.es
 *   "GILENIS PEREZ"  →  el mismo
 */

/** Dominio interno del identificador. No es un buzón: no se envía correo. */
export const DOMINIO_ACCESO = 'usuarios.skyranch.es'

/** Nombre → identificador estable: sin acentos, sin mayúsculas, sin dobles espacios. */
export function usuarioDeNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // fuera tildes y diéresis
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Identificador con forma de correo que entiende Supabase Auth. */
export function accesoDeNombre(nombre: string): string {
  return `${usuarioDeNombre(nombre)}@${DOMINIO_ACCESO}`
}

/** ¿Es un nombre usable? Al menos dos palabras y letras de verdad. */
export function nombreValido(nombre: string): boolean {
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio.length < 5) return false
  if (limpio.split(' ').length < 2) return false
  return usuarioDeNombre(limpio).length >= 5
}
