export const metadata = { title: 'Sin conexión · Fichajes' }

export default function Offline() {
  return (
    <main className="pagina" style={{ paddingTop: 48 }}>
      <div className="tarjeta centrado">
        <h1>Sin conexión</h1>
        <p className="suave" style={{ marginTop: 8 }}>
          No hay red ahora mismo. Los fichajes que hagas se guardan en el móvil y se envían solos
          cuando vuelva la cobertura.
        </p>
      </div>
    </main>
  )
}
