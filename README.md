# Fichajes

App de **registro de jornada** para móvil. Se instala desde un enlace o un QR (PWA),
sin App Store ni Google Play.

- **Fichar** entrada, pausas y salida con un botón grande. **La ubicación es
  obligatoria**: sin ella no se ficha. Si la posición cae fuera del recinto sale
  un aviso —«estás fuera de la finca, a X m»— y hay que confirmar; entonces el
  fichaje se registra marcado y le llega un aviso al responsable.
- **Dos tipos de usuario**: el administrador crea centros y da de alta a los
  trabajadores desde la propia app, corrige fichajes y descarga los informes; el
  trabajador solo ficha y consulta **su horario**.
- **Informes** descargables en CSV (Excel) y en PDF desde el propio navegador,
  por empleado o de todo el equipo, en dos niveles: resumen por jornada e
  **historial completo de movimientos** con las correcciones.
- **Avisos push** si se pasa la hora de entrada del turno, si la jornada se
  queda abierta, si alguien ficha fuera del centro o si un turno pasa sin
  fichar.
- **Mi horario**: el trabajador ve sus turnos en un calendario semanal, con las
  horas de esta semana y de la próxima, y puede desplegarlo a vista mensual. Solo
  turnos: **su histórico de fichajes no se muestra en la app**, para no convertir
  cada minuto en una discusión.
- **Planificación**: patrón semanal por persona y calendario generado a partir
  de él. En los informes el administrador ve lo trabajado frente a lo
  planificado.
- **Funciona sin cobertura**: si no hay red, el fichaje se guarda en el móvil con
  la hora real y se envía solo al recuperar señal.

## Stack

Next.js 14 (App Router, Server Components + Server Actions) · Supabase
(PostgreSQL + Auth + RLS) · Web Push (VAPID) · CSS plano con tokens.
Sin Tailwind y sin dependencias de UI.

En esta máquina solo hay **bun**:

```bash
bun install
bun run dev        # http://localhost:3000
bun run build      # build + comprobación de tipos
bun run pruebas    # pruebas de la lógica de cálculo (no necesita base de datos)
bun run vapid      # genera el par de claves de Web Push
bun run iconos     # regenera los iconos PNG de la PWA
```

`http://localhost:3000/demo` es la app **funcionando** con datos inventados:
navegación completa, conmutador **Trabajadora / Administrador** y botón de
reiniciar. Puedes fichar, corregir y anular fichajes, crear centros y
trabajadores, y planificar turnos de verdad — todo se guarda en el navegador,
no en un servidor, y aplica las mismas validaciones que la base de datos.
**Solo existe en desarrollo.** La ubicación se elige a mano (dentro del recinto,
a 1,2 km o sin GPS) porque el navegador de desarrollo no da geolocalización.

## Puesta en marcha

### 1. Base de datos

Crea un proyecto en [supabase.com](https://supabase.com) y pega
`db/schema.sql` completo en el **SQL Editor**. Es idempotente: puedes volver a
ejecutarlo cuando lo cambies.

Luego `db/seed.sql`, que ya trae el centro **SKYRANCH** (Rozas de Puerto Real,
Madrid: 40.317603, -4.474293) con radio de 400 m, holgado porque es una finca y
no un local de calle. También ajusta el radio desde la app cuando compruebes la
cobertura real del GPS dentro del recinto.

### 2. Variables de entorno

Copia `.env.local.example` a `.env.local` y rellena:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (**solo servidor**, nunca en el front) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `bun run vapid` |
| `VAPID_SUBJECT` | `mailto:` de contacto de la empresa |
| `CRON_SECRET` | invéntate una cadena larga |

### 3. Primer administrador

Este es el único usuario que hay que crear a mano; los demás se crean desde la
app.

1. Supabase → **Authentication → Users → Add user** con tu correo y contraseña.
2. Entra una vez en la app: el trigger te crea el perfil.
3. En el SQL Editor:

```sql
update perfiles set rol = 'admin' where email = 'tu@empresa.com';
```

### 4. Centros y personal

Todo desde **Equipo → Personal y centros**:

1. **Crea cada centro** (SKYRANCH ya viene en `db/seed.sql`): escribes la
   dirección y pulsas *Buscar en el mapa*
   (geocodificación con OpenStreetMap, sin claves de API), o pulsas *Estoy aquí*
   si estás dentro del local y toma las coordenadas del GPS. Luego el radio
   permitido: 150 m es un punto de partida razonable en ciudad; súbelo si el GPS
   falla dentro del local.
2. **Da de alta a cada trabajador**: nombre, correo, una contraseña temporal (el
   botón *Generar* propone una legible para dictarla por teléfono), centro,
   horas de contrato y rol. La cuenta queda lista al instante, sin pasar por
   Supabase ni depender de que haya correo configurado. Si alguien pierde la
   contraseña, la cambias desde su ficha.

Roles: `admin` (todo: centros, altas, correcciones, informes de todos),
`encargado` (solo su centro), `empleado` (solo ficha y ve lo suyo). El alcance no
lo decide la interfaz, lo decide RLS en la base de datos.

> El alta de cuentas necesita `SUPABASE_SERVICE_ROLE_KEY` en el servidor. Si no
> está, la app lo dice y hay que crear los usuarios desde el panel de Supabase.

### 5. Turnos

En **Equipo → Planificar turnos**: defines el patrón semanal de cada persona y
pulsas *Generar turnos* para el rango que quieras. Los turnos son la referencia
contra la que se comparan los fichajes y de la que salen los avisos y las
proyecciones. También puedes añadir turnos sueltos y cancelar los que sobren.

### 6. Despliegue en Netlify

El repo ya trae `netlify.toml` y la tarea programada de avisos en
`netlify/functions/avisos.mts` (cada 15 minutos). El plugin de Next.js lo añade
Netlify solo al detectar `next.config.js`.

**Se puede desplegar antes de tener Supabase.** Si faltan las variables, la app
real se desactiva y todo el tráfico va a `/demo`, que funciona sin base de
datos. Es la forma de probar en el móvil de verdad —con el GPS real, en la
finca— antes de montar nada.

Dos caminos:

**a) Desde esta máquina, con la CLI**

```bash
bunx netlify-cli deploy --build --prod
```

La primera vez abre el navegador para que inicies sesión y te pregunta si crear
un sitio nuevo.

**b) Conectando un repositorio**

Sube el repo a GitHub y en Netlify: *Add new site → Import an existing project*.
Detecta Next.js solo; el `netlify.toml` hace el resto. Cada `push` despliega.

**Variables de entorno del sitio** (Site configuration → Environment variables),
las mismas de `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` y
`CRON_SECRET`. Con `NEXT_PUBLIC_DEMO=off` se oculta la demo cuando ya no la
necesites.

Para probar los avisos a mano:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tu-sitio.netlify.app/api/cron/avisos
```

### 7. Instalar en el móvil

Manda el enlace o un QR a la plantilla.

- **Android / Chrome**: sale solo el aviso «Instalar app». Si no, menú ⋮ →
  *Añadir a pantalla de inicio*.
- **iPhone / Safari**: Compartir → *Añadir a pantalla de inicio*. **Es
  obligatorio** para que funcionen los avisos push: iOS solo los permite cuando
  la app se abre desde ese icono.

## Fichajes fuera del centro, correcciones e historial

**Nadie se queda sin poder fichar.** Si el GPS falla, si se niega el permiso o
si la persona está lejos del centro, el fichaje se guarda igual. Lo que cambia
es cómo queda marcado:

| Situación | Qué se guarda | Quién se entera |
|---|---|---|
| Dentro del radio | `dentro_radio = true` | nadie, es lo normal |
| Fuera del radio | `dentro_radio = false` y la distancia | aviso push + panel del responsable |
| Sin ubicación | `dentro_radio = null` | aparece como *Sin ubicación* en el informe |
| Turno que pasa sin fichar | nada, pero el turno queda sin cubrir | aviso push al responsable y fila «SIN FICHAR» en el informe |

**El administrador puede tocar cualquier fichaje**, de dos formas, y ninguna
borra nada:

- **Corregir**: se anula el original y se crea el corregido apuntando a él. En
  el historial se ven los dos, con la hora antigua tachada.
- **Anular**: el fichaje deja de contar para las horas pero sigue ahí, tachado,
  con quién lo anuló y el motivo (obligatorio, mínimo 3 caracteres).
- **Añadir** un fichaje que falta, también con motivo obligatorio.

En los tres casos le llega un aviso a la persona afectada, para que no se
encuentre sus horas cambiadas sin saberlo.

**Todo eso sale en la descarga.** Hay dos CSV:

- *CSV de jornadas*: una fila por día con entrada, salida, pausa, total, lo
  planificado, si la ubicación estaba verificada, **si se modificó a mano**,
  cuántos fichajes se anularon ese día, y filas explícitas `SIN FICHAR` para los
  turnos que pasaron en blanco.
- *CSV con historial*: una fila por movimiento, incluidos los anulados, con
  origen (app / sin cobertura / alta manual), distancia al centro, precisión del
  GPS, estado (vigente o anulado), a qué fichaje corrige, quién lo modificó,
  quién lo anuló, el motivo y cuándo llegó realmente a la base.

**El trabajador no ve su histórico de fichajes en la app**, por decisión de
producto. Ojo con esto: el art. 34.9 ET obliga a que el registro esté *a
disposición* de la persona trabajadora. Quitar la pantalla no elimina la
obligación, la convierte en una entrega a petición: cuando alguien lo pida, se
saca desde *Informes* filtrando por esa persona (CSV o PDF) y se le entrega.
Conviene dejarlo escrito en la información que se da a la plantilla.

## Cómo se calculan las horas

Todo el cálculo está en `lib/jornada.ts` y `lib/proyeccion.ts`, y está cubierto
por `bun run pruebas` (36 comprobaciones, incluidos turnos de noche y cambios de
hora).

- Una **jornada** va de `entrada` a `salida` y se imputa al día natural de la
  entrada, aunque cruce medianoche.
- Las **pausas** se descuentan del total.
- Una jornada abierta **hoy** cuenta el tiempo en curso; abierta en un día
  pasado se marca como incidencia `sin_salida`.
- Los fichajes **anulados no cuentan** para las horas, pero siguen en el
  historial y en el CSV de movimientos.
- La **proyección** es *lo ya fichado + los turnos que aún no han terminado*,
  comparado con las horas de contrato prorrateadas al periodo. Si no llega, la
  app dice cuántas horas faltan.

## Decisiones que conviene conocer

**El fichaje solo se puede crear con la función `fichar()` de la base de datos.**
La tabla `fichajes` no tiene políticas de INSERT/UPDATE/DELETE: nadie puede
escribir ni alterar el registro desde el cliente. `fichar()` valida la secuencia
(no puedes fichar salida sin entrada) y calcula la distancia al centro en el
servidor, para que el móvil no pueda declararse «dentro del radio».

**Las correcciones no borran nada.** `fichaje_manual()` añade, `fichaje_anular()`
marca sin borrar y `fichaje_corregir()` anula el original y crea el sustituto
apuntando a él. Siempre con autor y motivo. El registro sigue siendo trazable,
que es lo que pide una inspección.

**El alta de cuentas comprueba el rol en el servidor.** `crearEmpleado` usa la
`service_role`, que salta RLS, así que la verificación de que quien llama es
administrador está en la propia Server Action y no en la interfaz.

**El margen de error del GPS cuenta a favor de la persona.** Un fichaje se
considera dentro del centro si `distancia <= radio + precisión` (con la precisión
topada en 100 m). Un fichaje sin ubicación no se bloquea: se guarda marcado como
no verificado y aparece en el panel del responsable.

## Límites reales

- **La ubicación de un navegador se puede falsear** (los móviles permiten simular
  el GPS). Esta app sirve para detectar despistes y para tener el registro legal,
  no como control antifraude. Si necesitas eso, hace falta app nativa con
  *integrity check*, y aun así no es infalible.
- **Sin geovallado en segundo plano.** Una PWA no puede fichar sola al llegar al
  local ni vigilar la posición con la app cerrada. Requiere app nativa (Expo).
- **Los avisos push en iOS** exigen tener la app en la pantalla de inicio.
- El cron corre cada 15 minutos, así que un aviso puede llegar con ese retraso.

## Cumplimiento legal (España)

Pensado para el **registro de jornada** del art. 34.9 del Estatuto de los
Trabajadores (RD-ley 8/2019):

- Registra hora de inicio y fin de cada jornada, día a día.
- El registro se conserva 4 años y está a disposición de la persona trabajadora
  (pantalla *Mis jornadas*, con descarga en CSV y PDF), de sus representantes y
  de la Inspección de Trabajo (pantalla *Informes*).
- Las modificaciones quedan trazadas con autor y motivo.

Sobre la **geolocalización**, siguiendo el criterio de proporcionalidad de la
AEPD, se captura **solo en el instante del fichaje** y no durante la jornada. Aun
así, antes de usarla en producción te toca:

1. **Informar por escrito** a la plantilla (y a la representación legal) de qué
   se registra, para qué, cuánto se conserva y con qué base jurídica.
2. Recoger esa información en el **registro de actividades de tratamiento**.
3. Revisar el **convenio colectivo**, que puede añadir requisitos.

No es asesoramiento jurídico: que lo valide vuestro asesor laboral antes de
implantarlo.

## Estructura

```
app/
  actions.ts            ← Server Actions (fichar, turnos, correcciones, personal)
  layout.tsx, globals.css
  login/                ← acceso
  fichar/               ← pantalla principal de fichaje
  jornadas/             ← historial propio + descarga
  turnos/               ← turnos propios + proyecciones
  admin/                ← estado del equipo
  admin/informes/       ← informes y correcciones
  admin/turnos/         ← patrón semanal y calendario
  admin/empleados/      ← personal y centros (solo admin)
  api/informe/          ← CSV (el alcance lo limita RLS)
  api/cron/avisos/      ← cron de avisos push
  demo/                 ← comprobación visual, solo en desarrollo
components/             ← Reloj, BarraProyeccion, ListaJornadas, Nav, Cabecera…
lib/
  constants.ts          ← FUENTE ÚNICA de tipos, transiciones y umbrales
  jornada.ts            ← reconstrucción de jornadas desde fichajes
  proyeccion.ts         ← objetivo, proyección y desviación
  fechas.ts             ← zona horaria, cambios de hora, formatos
  geo.ts                ← Haversine y permiso de ubicación
  push.ts, sesion.ts, supabase/
db/schema.sql           ← tablas, funciones, vistas y RLS
db/seed.sql             ← centro SKYRANCH y alta del primer admin
public/sw.js            ← service worker (caché + push)
scripts/                ← pruebas, claves VAPID, iconos
```

## Pendiente

1. Vacaciones y ausencias (bajas, permisos) para que el objetivo del periodo las
   descuente en vez de contarlas como horas no cumplidas.
2. Resumen semanal por correo al responsable (Resend) con las incidencias.
3. Fichaje por QR en el local como refuerzo de la ubicación.
4. Firma o exportación sellada del informe mensual.
5. Recuperación de contraseña desde la propia app (hoy la cambia el admin).
6. Mapa en el panel con el punto del fichaje que cayó fuera del radio.
