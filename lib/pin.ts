/**
 * PIN de acceso rápido.
 *
 * Qué es: un cierre **local** encima de la sesión que ya está abierta, para no
 * escribir nombre y contraseña cada mañana en el campo, con guantes.
 *
 * Qué NO es: autenticación. Quien manda es la sesión de Supabase; el PIN solo
 * decide si esta app, en este móvil, se abre directamente o pide cuatro
 * dígitos. Protege de que un compañero coja tu teléfono, no de alguien decidido
 * que sepa borrar los datos del navegador. Está dicho así en la interfaz.
 *
 * El PIN no viaja a ningún servidor: se guarda su hash con sal, aquí.
 */

const CLAVE = 'skyranch:pin'
const LONGITUD = 4

type PinGuardado = {
  sal: string
  hash: string
  /** Para saludar por su nombre en la pantalla de bloqueo. */
  nombre: string
  creado: string
}

function aHex(datos: ArrayBuffer): string {
  return [...new Uint8Array(datos)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hashear(pin: string, sal: string): Promise<string> {
  const datos = new TextEncoder().encode(`${sal}:${pin}`)
  return aHex(await crypto.subtle.digest('SHA-256', datos))
}

export function pinConfigurado(): PinGuardado | null {
  try {
    const bruto = localStorage.getItem(CLAVE)
    return bruto ? (JSON.parse(bruto) as PinGuardado) : null
  } catch {
    return null
  }
}

export function pinValido(pin: string): boolean {
  return new RegExp(`^\\d{${LONGITUD}}$`).test(pin)
}

/** Rechaza los PIN que no protegen de nada. */
export function pinDebil(pin: string): string | null {
  if (/^(\d)\1+$/.test(pin)) return 'Ese PIN son cuatro cifras iguales'
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) {
    return 'Ese PIN son cuatro cifras seguidas'
  }
  return null
}

export async function guardarPin(pin: string, nombre: string): Promise<void> {
  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const guardado: PinGuardado = {
    sal,
    hash: await hashear(pin, sal),
    nombre,
    creado: new Date().toISOString(),
  }
  localStorage.setItem(CLAVE, JSON.stringify(guardado))
}

export async function comprobarPin(pin: string): Promise<boolean> {
  const guardado = pinConfigurado()
  if (!guardado) return false
  return (await hashear(pin, guardado.sal)) === guardado.hash
}

export function borrarPin(): void {
  try {
    localStorage.removeItem(CLAVE)
    sessionStorage.removeItem(ABIERTO)
  } catch {
    // sin almacenamiento no hay PIN que borrar
  }
}

// --- Estado de "abierto" ----------------------------------------------------
// Vive en sessionStorage: al cerrar la pestaña se vuelve a pedir el PIN.

const ABIERTO = 'skyranch:pin:abierto'

export function estaAbierto(): boolean {
  try {
    return sessionStorage.getItem(ABIERTO) === '1'
  } catch {
    return true // sin almacenamiento, no bloqueamos: mejor abierto que atascado
  }
}

export function marcarAbierto(): void {
  try {
    sessionStorage.setItem(ABIERTO, '1')
  } catch {
    // ignorado a propósito
  }
}

export function marcarCerrado(): void {
  try {
    sessionStorage.removeItem(ABIERTO)
  } catch {
    // ignorado a propósito
  }
}

export const LONGITUD_PIN = LONGITUD
