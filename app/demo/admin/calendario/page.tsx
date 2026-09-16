export const metadata = { title: 'Demo · Calendario' }

export default function DemoCalendario() {
  return (
    <main className="pagina">
      <div className="tarjeta">
        <header>
          <h2>Calendario</h2>
        </header>
        <p className="vacio">
          Este apartado muestra tu Google Calendar real y solo existe conectado a un servidor de
          verdad; la demo no lo simula.
        </p>
      </div>
    </main>
  )
}
