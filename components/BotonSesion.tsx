import { cerrarSesion } from '@/app/actions'

/** Iniciales para el avatar: "Carlos Raúl Pérez" → "CP". */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  const primera = partes[0]?.[0] ?? '?'
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return `${primera}${ultima}`.toUpperCase()
}

/**
 * Cuenta abierta, abajo a la derecha: quién está dentro y el botón de salir.
 *
 * En la consola no había forma de cerrar sesión — las pantallas de `/admin` no
 * llevan `Cabecera`, que es donde vivía «Salir». Al salir se vuelve a la
 * pantalla de entrar, así que también sirve para que entre otra persona.
 */
export default function BotonSesion({
  nombre,
  rol,
  soloLectura = false,
}: {
  nombre: string
  rol?: string
  /** En la demo no hay sesión de verdad que cerrar. */
  soloLectura?: boolean
}) {
  return (
    <div className="sesion no-imprimir">
      <span className="sesion-avatar" aria-hidden="true">
        {iniciales(nombre)}
      </span>

      <span className="sesion-quien">
        <span className="sesion-nombre truncar">{nombre}</span>
        {rol && <span className="sesion-rol truncar">{rol}</span>}
      </span>

      {soloLectura ? (
        <span className="sesion-salir" title="En la demo no hay sesión que cerrar" aria-hidden="true">
          <IconoSalir />
        </span>
      ) : (
        <form action={cerrarSesion}>
          <button type="submit" className="sesion-salir" title="Cerrar sesión">
            <IconoSalir />
            <span className="oculto">Cerrar sesión</span>
          </button>
        </form>
      )}
    </div>
  )
}

function IconoSalir() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M16 8l4 4-4 4" />
      <path d="M20 12H10" />
    </svg>
  )
}
