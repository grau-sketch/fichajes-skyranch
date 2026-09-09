export const metadata = { title: 'Sin configurar · Fichajes' }

export default function SinConfigurar() {
  return (
    <main className="pagina" style={{ paddingTop: 48 }}>
      <div className="tarjeta columna" style={{ gap: 10 }}>
        <h1>Falta configurar la base de datos</h1>
        <p className="suave pequeno">
          Este despliegue no tiene todavía las variables de Supabase, así que la app no puede
          guardar fichajes.
        </p>
        <p className="pequeno">
          Añade <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
          en las variables de entorno del sitio y vuelve a desplegar.
        </p>
      </div>
    </main>
  )
}
