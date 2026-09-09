import Link from 'next/link'
import { cerrarSesion } from '@/app/actions'
import Marca from '@/components/Marca'

export default function Cabecera({
  titulo,
  subtitulo,
  volver,
}: {
  titulo: string
  subtitulo?: string
  volver?: string
}) {
  return (
    <header className="cabecera no-imprimir">
      <div className="cabecera-inner">
        <div className="crece">
          <Marca />
          {volver && (
            <Link href={volver} className="mini suave" style={{ display: 'block' }}>
              ← Volver
            </Link>
          )}
          <h1>{titulo}</h1>
          {subtitulo && <p className="quien truncar">{subtitulo}</p>}
        </div>
        <form action={cerrarSesion}>
          <button type="submit" className="btn mini" aria-label="Cerrar sesión">
            Salir
          </button>
        </form>
      </div>
    </header>
  )
}
