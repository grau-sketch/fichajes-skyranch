import FormularioLogin from './FormularioLogin'

export const metadata = { title: 'Entrar · Fichajes' }

export default function Login({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string }
}) {
  return (
    <main className="pagina" style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
      <div className="centrado columna" style={{ gap: 6, marginBottom: 8 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icono-192.png"
          alt=""
          width={64}
          height={64}
          style={{ borderRadius: 16, margin: '0 auto' }}
        />
        <h1>Fichajes</h1>
        <p className="suave pequeno">Registro de jornada</p>
      </div>

      {searchParams.error === 'sin-perfil' && (
        <p className="nota aviso">
          Tu usuario existe pero no tiene perfil asignado. Avisa a tu responsable.
        </p>
      )}

      <div className="tarjeta">
        <FormularioLogin destino={searchParams.redirect ?? '/fichar'} />
      </div>

      <p className="mini suave centrado">
        Añade esta página a la pantalla de inicio para usarla como una app.
      </p>
    </main>
  )
}
